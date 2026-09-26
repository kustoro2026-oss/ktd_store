/**
 * Build Blibli mass-upload Excel from anekadropship.id product data.
 *
 * Steps:
 *   1. Login ke anekadropship.id (credentials dari .env / env vars)
 *   2. Scrape detail setiap produk (deskripsi, berat, dimensi, varian)
 *   3. Map kategori ke Blibli category tree (L1 > L2 > L3)
 *   4. Map lokasi seller -> Kode Pickup Point Blibli (blibli-upload/pickup-plan.json)
 *   5. Generate Excel sesuai template Blibli v2.0 (sheet Upload + sheet "Toko")
 *
 * Usage:
 *   node scripts/build-blibli-upload.cjs            # scrape semua + generate
 *   node scripts/build-blibli-upload.cjs --no-scrape # generate dari detail-cache saja
 *   node scripts/build-blibli-upload.cjs --ids-file=blibli-upload/ids-add.json --output=blibli-add.xlsx
 *     -> mode ADD inkremental: proses hanya id di file JSON array + nama output khusus
 *
 * Output:
 *   blibli-upload/blibli-mass-upload.xlsx
 *   blibli-upload/blibli-detail-cache.json   (hasil scrape, bisa di-resume)
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const cheerio = require("cheerio");

// ─── Config ────────────────────────────────────────────────────────────────
const BASE = "https://anekadropship.id";
const EMAIL = process.env.ANEKA_EMAIL || "kustoroterbatas@gmail.com";
const PASSWORD = process.env.ANEKA_PASSWORD || "@$Kustores2k24";
const SITE_URL = "https://toko.kustoro2026.com";

const CACHE_PATH = path.join(__dirname, "..", "src", "lib", "products-cache.json");
const IMG_MAP_PATH = path.join(__dirname, "..", "src", "lib", "product-images.json");
const OUTPUT_DIR = path.join(__dirname, "..", "blibli-upload");
const argVal = (name) => {
    const pref = `--${name}=`;
    const hit = process.argv.find((a) => a.startsWith(pref));
    return hit ? hit.slice(pref.length) : "";
};
const OUTPUT_NAME = argVal("output");
const IDS_FILE = argVal("ids-file");
const OUTPUT_FILE = path.join(OUTPUT_DIR, OUTPUT_NAME || "blibli-mass-upload.xlsx");
const DETAIL_CACHE_FILE = path.join(OUTPUT_DIR, "blibli-detail-cache.json");

const DELAY_MS = 600; // jeda antar request
const CF_CLEARANCE = process.env.CF_CLEARANCE || "";
const CF_BM = process.env.CF_BM || "";

// Pickup point plan: kode PP per seller-location (sheet "Toko")
const PLAN_PATH = path.join(OUTPUT_DIR, "pickup-plan.json");
const DEFAULT_PICKUP_POINT = "PP-3587819";

// Entitas XML/HTML dibangun runtime ("&"+"amp;") supaya file script ini
// tidak rusak oleh pipeline tool yang meng-decode entitas (pernah kejadian:
// "&amp;" tertulis sebagai "&", membuat xmlEscape jadi no-op).
const XML_AMP = "&" + "amp;";
const XML_LT = "&" + "lt;";
const XML_GT = "&" + "gt;";
const ENT_QUOT = new RegExp("&" + "quot;", "g");
const ENT_AMP = new RegExp("&" + "amp;", "g");
const ENT_GT = new RegExp("&" + "gt;", "g");
const ENT_LT = new RegExp("&" + "lt;", "g");

const NO_SCRAPE = process.argv.includes("--no-scrape");

// ─── Blibli category mapping (keyword nama produk -> "c1 > c2 > cn") ───────
// c1 harus salah satu dari 16 kategori resmi; cn boleh berisi chain "->"
// (mis. "Pembersih Pakaian->Deterjen"). Urutan rule = prioritas (first match wins),
// rule spesifik harus berada di atas rule generik.
const CATEGORY_MAP = [
    { k: ["sabun cuci piring", "cuci piring", "dish soap", "pembersih dapur", "kitchen cleaner", "pembersih kompor", "pembersih stainless", "stainless cleaner"], c: "Bliblimart > Perawatan Rumah Tangga > Pembersih Dapur->Cairan Pembersih Dapur" },
    { k: ["sabun cuci tangan", "sabun tangan", "hand soap", "hand sanitizer", "sanitizer", "sanitasi tangan"], c: "Bliblimart > Perawatan Kulit Tubuh > Perawatan Kulit Badan->Perawatan Kulit Tangan->Sabun Pencuci Tangan" },
    { k: ["pengharum ruangan", "air freshener", "pewangi ruangan", "penghilang bau", "odor", "kamper", "kapur barus"], c: "Bliblimart > Perawatan Rumah Tangga > Pengharum Ruangan->Cairan Pengharum Ruangan" },
    { k: ["detergen", "deterjen", "sabun cuci", "pemutih", "bleach", "pelembut pakaian", "pelicin pakaian", "penghilang noda", "luntur", "sodium chloride", "pewangi pakaian", "sidoarjo"], c: "Bliblimart > Perawatan Rumah Tangga > Pembersih Pakaian->Deterjen" },
    { k: ["pembersih toilet", "toilet cleaner", "pembersih kamar mandi", "anti kerak", "anti jamur", "pembersih saluran", "anti sumbat", "wc mampet", "saluran", "mampet", "tersumbat", "bubuk ajaib", "sedot wc", "pipa", "drain"], c: "Bliblimart > Perawatan Rumah Tangga > Pembersih Kamar Mandi" },
    { k: ["pembersih lantai", "floor cleaner", "pembersih kaca", "glass cleaner", "pembersih serbaguna", "multipurpose", "disinfektan", "desinfektan", "karbol", "anti noda", "glow home", "glowhome"], c: "Bliblimart > Perawatan Rumah Tangga > Pembersih Lantai" },
    { k: ["pupuk", "nutrisi tanaman", "vitamin tanaman", "perangsang bunga", "perangsang buah", "benih", "bibit", "pestisida", "calsira", "hormon tanaman", "humat", "humic", "penyubur tanah", "pembenah tanah"], c: "Home & Living > Peralatan Taman & Luar Ruang > Tanaman" },
    { k: ["paranet", "shade net", "jaring tanaman", "net tanaman"], c: "Home & Living > Peralatan Taman & Luar Ruang > Perlengkapan Taman Lainnya" },
    { k: ["umpan", "umpan pancing", "umpan ikan", "fish attractant", "fishing", "additive", "essen", "esssen", "mancing", "pancing", "joran", "senar", "kail", "mata kail"], c: "Home & Living > Hobby & Interest > Memancing->Aksesoris Memancing" },
    { k: ["ikan", "udang", "pakan ikan", "pelet ikan", "penggemuk ikan", "kolam", "lele", "gurame", "nila", "bawal", "mujair", "akuarium", "aquarium", "aquascape", "ikan koi", "cupang"], c: "Home & Living > Hewan Peliharaan/Pet Supplies > Aquatic->Makanan, Vitamin & Obat Ikan" },
    { k: ["hewan", "pet", "kucing", "anjing", "kandang", "ternak", "unggas", "sapi", "kambing", "ayam", "bebek", "puyuh", "burung", "penggemuk ternak", "penggemuk hewan", "penggemuk ayam", "perawatan hewan", "kesehatan hewan", "vitamin hewan", "vitamin ternak", "suplemen ternak", "suplemen hewan", "max centin", "pemerah telur", "xantaxenthin"], x: ["sepatu", "sandal", "sneakers", "boots", "slipper", "tas", "dompet", "jaket", "sabuk"], c: "Home & Living > Hewan Peliharaan/Pet Supplies > Hewan Lainnya->Perawatan Kesehatan Hewan Lainnya" },
    { k: ["anti rayap", "anti tungau", "pengusir semut", "pengusir kecoa", "anti tikus", "racun tikus", "hantavirus", "pembasmi serangga", "pengusir serangga", "naphtalene", "katakill", "pembasmi kutu", "kutu tungau", "pembasmi rumput", "herbisida", "rumput liar", "obat rumput"], c: "Bliblimart > Perawatan Rumah Tangga > Pembasmi Hama & Serangga->Cairan Pembasmi Hama & Serangga" },
    { k: ["madu"], c: "Bliblimart > Minuman > Sirup & Madu->Madu" },
    { k: ["sari lemon", "sari buah", "jus", "juice"], c: "Bliblimart > Minuman > Jus" },
    { k: ["4g lucky", "perawatan pria", "herbal pria", "minyak pria", "pria perkasa", "vitalitas pria", "kesuburan pria", "ejakulasi", "penguat pria", "obat kuat", "kejantanan"], c: "Kesehatan & Kecantikan > Perawatan Pria > Perawatan Tubuh" },
    { k: ["minyak angin", "balsem", "koyo", "salep", "ointment", "minyak urut", "minyak gosok", "minyak kayu putih", "minyak telon", "minyak oles", "minyak tawon", "pegal", "linu", "nyeri otot", "nyeri sendi", "herbal spray"], c: "Kesehatan & Kecantikan > P3K > Pereda Nyeri Otot" },
    { k: ["suplemen", "vitamin", "mineral", "herbal", "kapsul", "tablet", "imun", "daya tahan", "stamina", "nafsu makan", "penambah nafsu", "habbatussauda", "habbat", "propolis", "royal jelly", "susu kambing", "orthomil", "geebumin", "kolagen", "collagen", "sheshine", "penambah berat badan", "penggemuk badan"], c: "Kesehatan & Kecantikan > Vitamin & Suplemen > Herbal->Suplemen" },
    { k: ["kaki tabib", "rendaman kaki", "foot soak", "perawatan kaki", "kaki pecah", "kaki kasar", "kaki kapalan", "callus", "kapalan", "mata ikan", "heel", "tumit", "pedicure", "krim kaki", "foot cream", "foot mask"], c: "Kesehatan & Kecantikan > Perawatan Tubuh > Perawatan Kaki->Foot Creams & Lotions" },
    { k: ["sabun wajah", "facial soap", "facial wash", "sabun muka", "sabun herbal", "sabun natural", "beauty soap", "probiotic soap", "sabun kecantikan", "pembersih wajah"], c: "Bliblimart > Perawatan Kulit Tubuh > Perawatan Kulit Wajah->Pembersih Kulit Wajah->Sabun Wajah" },
    { k: ["shampoo", "sampo", "conditioner", "hair mask", "hair serum", "hair oil", "hair tonic", "hair treatment", "hair vitamin", "hair care", "penumbuh rambut", "penyubur rambut", "anti rontok", "rambut rontok", "ketombe"], c: "Kesehatan & Kecantikan > Perawatan Rambut > Shampoo" },
    { k: ["scentnice", "hair spray", "pomade", "hair wax", "hair gel", "styling", "penata rambut", "gel rambut"], c: "Bliblimart > Perawatan Kulit Tubuh > Kesehatan Rambut->Styling Rambut->Gels, Pomades, Mousses, Wax" },
    { k: ["sabun mandi", "body wash", "shower gel", "body lotion", "body butter", "body cream", "body scrub", "body serum", "hand cream", "hand body", "deodorant", "deodoran", "body care"], c: "Kesehatan & Kecantikan > Perawatan Tubuh > Sabun Mandi" },
    { k: ["cream", "serum", "pelembab", "moisturizer", "toner", "facial", "wajah", "glowing", "firming", "retinol", "skincare", "kecantikan", "kosmetik", "makeup", "lipstick", "bedak", "foundation", "masker", "sunscreen", "bb cream", "cc cream", "lotion", "whitening", "brightening", "anti aging", "anti jerawat", "acne", "pimple", "cleanser", "micellar", "cleansing", "lao li shi", "nutricream", "meili"], x: ["kemeja", "blouse", "blus", "dress", "daster", "gamis", "kaftan", "tunik", "koko", "kaos", "baju", "rok", "celana", "jaket", "hoodie", "sweater", "cardigan", "vest", "polo", "hem", "batik", "atasan", "bawahan", "outer", "sepatu", "sandal"], c: "Bliblimart > Perawatan Kulit Tubuh > Perawatan Kulit Wajah->Perawatan Intensif Wajah->Serum Wajah" },
    { k: ["parfum", "wewangian", "fragrance", "minyak wangi", "perfume", "cologne", "body mist", "hair mist"], c: "Kesehatan & Kecantikan > Pengharum & Parfum > Parfum Wanita->Eau De Perfume & Perfume" },
    { k: ["kuku", "nail", "cat kuku", "kutek", "manicure", "nail art"], c: "Kesehatan & Kecantikan > Kutek & Perawatan Kuku > Perawatan Kuku" },
    { k: ["gigi", "tooth", "dental", "pasta gigi", "toothpaste", "sikat gigi", "mouthwash", "obat kumur", "floss", "pemutih gigi"], c: "Bliblimart > Perawatan Kulit Tubuh > Kesehatan Mulut & Gigi->Pasta Gigi Umum" },
    { k: ["mata", "eyelash", "bulu mata", "alis", "eyebrow", "eyeliner", "mascara", "eye shadow", "softlens", "lensa kontak"], c: "Kesehatan & Kecantikan > Perawatan Wajah > Perawatan Mata->Perawatan Bulu Mata & Alis" },
    { k: ["3d nose", "nose", "pemancung hidung", "hidung", "nose secret", "nose up", "nose shaper"], c: "Kesehatan & Kecantikan > Perangkat Kecantikan > Perangkat Kecantikan Lainnya" },
    { k: ["alat pijat", "pijat", "refleksi", "urut", "relaksasi", "terapi", "tai chi", "pernapasan", "akupresur", "akupunktur"], c: "Kesehatan & Kecantikan > Peralatan Medis > Perlengkapan Medis->Perban & Alat Terapi" },
    { k: ["sarung tangan"], c: "Fashion & Accessories > Wanita > Tas & Aksesoris Wanita->Aksesoris Wanita Lainnya" },
    { k: ["pelumas", "r-46", "grease", "gemuk mesin"], c: "Otomotif > Perawatan Kendaraan > Pelumas Mobil" },
    { k: ["semir ban", "tire shine", "poles ban", "pembersih ban"], c: "Otomotif > Perawatan Kendaraan > Cairan Pembersih Ban" },
    { k: ["interior cleaner", "pembersih interior", "instant coating", "dashboard", "semir", "wax leather", "leather care", "shoes cleaner", "perawatan sepatu"], c: "Otomotif > Perawatan Kendaraan > Cairan Pembersih Interior Kendaraan" },
    { k: ["rubbing compound", "glass coating", "pengkilap", "penghapus baret", "baret", "cat mobil", "poles", "polish", "black magic", "body mobil", "snow wash"], c: "Otomotif > Perawatan Kendaraan > Cairan Pembersih Eksterior Kendaraan" },
    { k: ["aksesoris mobil", "stiker mobil", "stiker kaca", "mobil", "motor", "otomotif", "kampas", "oli", "sparepart", "spare part", "klakson"], c: "Otomotif > Aksesoris Mobil > Eksterior Mobil->Aksesories Bodi Mobil" },
    { k: ["senter", "flashlight"], c: "Perkakas & Elektrikal > Penerangan > Senter" },
    { k: ["lampu", "led", "bohlam", "lighting", "night light", "lampu tidur", "lampu meja", "lampu hias", "lampu emergency", "lampu taman", "lampu solar", "strip led", "downlight", "spotlight", "panel light", "lampu sorot", "lampu gantung", "chandelier", "lampu dinding", "lampu plafon", "ceiling light", "lampu rgb", "lampu h4", "lampu h7", "lampu h11", "lampu mobil", "lampu motor", "headlamp", "proyektor"], c: "Perkakas & Elektrikal > Penerangan > Bohlam Lampu" },
    { k: ["kipas"], c: "Peralatan Elektronik > Cooling, Heating & Air Quality > Kipas Angin->Kipas Multi Fungsi" },
    { k: ["dompet", "wallet"], c: "Fashion & Accessories > Wanita > Tas & Aksesoris Wanita->Dompet Wanita" },
    { k: ["tas", "bag", "sling", "backpack", "ransel", "tote", "clutch", "handbag", "selempang"], c: "Fashion & Accessories > Wanita > Tas & Aksesoris Wanita->Tas Ransel Wanita" },
    { k: ["sandal", "slipper"], c: "Fashion & Accessories > Pria > Sepatu & Sandal Pria->Sandal Pria" },
    { k: ["boots", "boot"], c: "Fashion & Accessories > Pria > Sepatu & Sandal Pria->Boots Pria" },
    { k: ["sepatu", "flat shoes", "flatshoes", "heels", "sneakers"], c: "Fashion & Accessories > Pria > Sepatu & Sandal Pria->Formal Pria" },
    { k: ["hijab", "jilbab", "khimar", "pashmina", "ciput", "turban", "cadar"], c: "Fashion Muslim > Hijab & Jilbab > Jilbab Instant" },
    { k: ["mukena"], c: "Fashion Muslim > Perlengkapan Ibadah > Mukena Dewasa" },
    { k: ["sprei", "bed cover", "bedcover", "seprai", "sarung bantal", "sarung guling", "linen", "bed sheet", "selimut"], c: "Home & Living > Perlengkapan Kamar Tidur > Sprei, Sarung Bantal, & Sarung Guling->Sprei" },
    { k: ["sarung anak"], c: "Fashion Muslim > Perlengkapan Ibadah > Sarung Anak" },
    { k: ["sarung"], c: "Fashion Muslim > Perlengkapan Ibadah > Sarung Dewasa" },
    { k: ["boneka", "doll", "plush"], c: "Mainan, Buku & Stationery > Aneka Boneka > Boneka Karakter" },
    { k: ["mainan", "toys", "puzzle", "lego", "board game", "remote control", "edukasi"], c: "Mainan, Buku & Stationery > Mainan Edukasi dan Seni > Permainan Edukasi Lainnya" },
    // ── Koreksi produk DEWASA yang dulu salah tertangkap rule anak (keyword
    // "katun"/"cotton combed"/"gamis"/"tidur" terlalu luas). Rule di bawah
    // memakai m: (wajib ada) dan x: (pengecualian) agar tetap presisi.
    { k: ["baju koko", "koko"], x: ["anak", "bayi", "kids"], c: "Fashion Muslim > Pakaian Muslim Pria > Baju Koko" },
    { k: ["batik"], m: ["pria"], x: ["anak", "bayi", "kids", "daster"], c: "Fashion & Accessories > Pria > Pakaian & Bawahan Pria->Batik Pria" },
    { k: ["kaftan"], x: ["anak", "bayi", "kids"], c: "Fashion Muslim > Dress Muslim Wanita > Kaftan" },
    { k: ["kaos polos", "graphic tee", "kaos anime"], m: ["pria"], x: ["anak", "bayi", "kids", "usia"], c: "Fashion & Accessories > Pria > Pakaian & Bawahan Pria->Kaos Pria" },
    { k: ["daster", "baju tidur", "nightgown", "sleepwear"], x: ["anak", "bayi", "kids", "usia"], c: "Fashion & Accessories > Wanita > Pakaian & Bawahan Wanita->Baju Tidur Wanita" },
    { k: ["blouse"], m: ["wanita"], x: ["anak", "bayi", "kids"], c: "Fashion & Accessories > Wanita > Pakaian & Bawahan Wanita->Blouse & Kemeja Wanita" },
    { k: ["setelan", "jumba", "onset", "anak", "piyama", "set anak", "boy series", "jubah", "gamis", "anak laki", "anak perempuan", "tidur", "usia", "cotton combed", "katun", "pakaian anak", "baju anak", "kaos anak", "celana anak"], c: "Fashion & Accessories > Anak > Pakaian & Bawahan Anak->Atasan Anak" },
    { k: ["celana dalam", "underwear", "lingerie", "pakaian dalam", "bra", "panty"], c: "Fashion & Accessories > Wanita > Pakaian & Bawahan Wanita->Pakaian Dalam Wanita" },
    { k: ["hot pants", "celana pendek", "celana", "short"], c: "Fashion & Accessories > Wanita > Pakaian & Bawahan Wanita->Celana Wanita" },
    { k: ["baju", "kaos", "kemeja", "dress", "jaket", "rok", "pakaian", "fashion", "gamish", "atasan", "blouse", "outer"], c: "Fashion & Accessories > Wanita > Pakaian & Bawahan Wanita->Blouse & Kemeja Wanita" },
    { k: ["gelang", "kalung", "cincin", "anting", "liontin", "perhiasan", "giok", "tibet", "feng shui", "pixiu", "hematite", "gantungan kunci", "kunigan", "titanium", "batu akik", "om mani"], c: "Fashion & Accessories > Wanita > Tas & Aksesoris Wanita->Perhiasan Wanita" },
    { k: ["cuka apel", "cuka nanas", "apple cider", "vinegar", "with mother", "nutrivit", "glutamin", "penyedap", "probiotik", "vanilla bean", "vanilla extract", "vanila", "gourmet", "chia seed", "black chia", "kurma", "dates"], c: "Bliblimart > Sembako & Bumbu Masak > Bumbu Masak->Cuka" },
    { k: ["makanan", "minuman", "snack", "cemilan", "kopi", "teh", "sereal", "cokelat", "biskuit", "kue", "sirup", "bumbu", "rempah", "susu", "minyak goreng", "beras"], c: "Bliblimart > Aneka Cemilan > Biskuit & Snack->Biskuit & Snack Lainnya" },
    { k: ["alat dapur", "panci", "wajan", "pisau", "sendok", "garpu", "talenan", "dapur", "wadah", "botol", "tupperware", "lunch box", "tumbler", "cookware", "parutan", "pengiris", "mandoline", "slicer", "panggangan", "grill", "bbq", "pemanggang", "barbecue", "non stick", "gelas", "piring", "mangkuk", "peralatan masak"], c: "Home & Living > Perlengkapan Dapur > Peralatan Memasak & Memanggang" },
    { k: ["charger", "kabel", "type-c", "usb", "powerbank", "fast charging", "adapter", "adaptor", "cable"], c: "Handphone, Tablet & Wearable Gadget > Aksesoris Handphone & Tablet > Charger" },
    { k: ["cooler hp", "pendingin hp", "heatsink", "pendingin handphone", "cooling pad", "casing", "tempered glass", "screen protector"], c: "Handphone, Tablet & Wearable Gadget > Aksesoris Handphone & Tablet > Aksesoris Lainnya" },
    { k: ["cctv", "kamera", "wifi", "pengintai", "pengawas", "pemantau", "keamanan", "ip camera", "webcam", "surveillance"], c: "Peralatan Elektronik > Smart Home & Security > Security & CCTV->Kamera CCTV" },
    { k: ["speaker", "sound system", "home theater"], c: "Peralatan Elektronik > Audio > Speaker->Active Speaker" },
    { k: ["headphone", "earphone", "headset", "tws", "earbuds", "handsfree"], c: "Peralatan Elektronik > Audio > Earphone & Headphone->Earphone->Wireless In Ear" },
    { k: ["bor", "drill", "screwdriver", "obeng", "cordless", "alat tambal", "kaca retak", "windshield", "glass repair", "alat sisir", "vacum", "vakum", "v comb", "lem"], c: "Perkakas & Elektrikal > Perkakas > Perkakas Tangan" },
    { k: ["pembersih"], c: "Bliblimart > Perawatan Rumah Tangga > Pembersih Lantai" },
];

// Precompile pola keyword dengan batas kata (hindari salah-match substring,
// mis. "gan" pada "Perlindungan" atau "tas" pada "Ramtus").
// m: keyword wajib (semua harus ada), x: pengecualian (salah satu ada -> skip).
const kwToRe = (kw) => new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
const CATEGORY_RULES = CATEGORY_MAP.map((rule) => ({
    c: rule.c,
    res: rule.k.map(kwToRe),
    must: (rule.m || []).map(kwToRe),
    not: (rule.x || []).map(kwToRe),
}));

function mapCategory(name) {
    const n = (name || "").toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.not.length && rule.not.some((re) => re.test(n))) continue;
        if (rule.must.length && !rule.must.every((re) => re.test(n))) continue;
        for (const re of rule.res) {
            if (re.test(n)) return rule.c;
        }
    }
    return "";
}

// ─── Mapping nilai varian ke enum resmi Blibli (sheet 'inputs' Input 6) ────
// Blibli memvalidasi nilai "Ukuran"/"Warna" yang diikat lewat kolom varian
// terhadap daftar nilai per-Cn (mis. daster "Allsize" DITOLAK; harus
// "International ​- Free Size"). Peta diekstrak via
// scripts/_extract-variant-enums.cjs -> blibli-upload/blibli-variant-enums.json.
const VARIANT_ENUMS_FILE = path.join(OUTPUT_DIR, "blibli-variant-enums.json");
let VARIANT_ENUMS = { input6: {} };
try {
    VARIANT_ENUMS = JSON.parse(fs.readFileSync(VARIANT_ENUMS_FILE, "utf8"));
} catch { /* opsional: tanpa file, nilai varian ditulis apa adanya */ }
const enumNorm = (s) =>
    String(s).replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const ALLSIZE_COMPACT = new Set(["allsize", "onesize", "freesize", "universal", "allsizejumbo", "jumbo", "fitall"]);
const ALLSIZE_PREFS = [
    "international - free size",
    "international - one size",
    "international - all size m",
    "adult all size",
    "1 size",
    "international - plus size",
    "international - big size",
];
let enumMapped = 0;
let enumUnmapped = 0;
const enumUnmappedSamples = [];
let inferredNameProducts = 0; // produk yg axis variannya di-infer dari nama
let dedupeMergedRows = 0; // baris varian kembar (kombinasi sama) yg stoknya digabung
function mapVariantValue(cnPath, attr, raw) {
    if (!raw) return raw;
    const entry = VARIANT_ENUMS.input6[`${cnPath}_${attr}`];
    if (!entry) return raw; // atribut tidak divalidasi enum utk Cn ini
    const vals = entry.vals;
    if (vals.includes(raw)) return raw;
    const nRaw = enumNorm(raw);
    let hit = vals.find((v) => enumNorm(v) === nRaw);
    if (!hit) hit = vals.find((v) => enumNorm(v) === `international - ${nRaw}`);
    if (!hit && ALLSIZE_COMPACT.has(nRaw.replace(/[^a-z0-9]/g, ""))) {
        for (const pref of ALLSIZE_PREFS) {
            hit = vals.find((v) => enumNorm(v) === pref);
            if (hit) break;
        }
    }
    if (hit) {
        enumMapped++;
        return hit;
    }
    enumUnmapped++;
    if (enumUnmappedSamples.length < 10) enumUnmappedSamples.push(`${attr}="${raw}" (${cnPath.split("->").pop()})`);
    return raw;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function buildCookie(sessionCookie) {
    const parts = [];
    if (CF_CLEARANCE) parts.push(`cf_clearance=${CF_CLEARANCE}`);
    if (CF_BM) parts.push(`__cf_bm=${CF_BM}`);
    if (sessionCookie) parts.push(sessionCookie);
    return parts.join("; ");
}

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BROWSER_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
};

async function login() {
    let cookie = "";
    const grab = (res) => {
        const setCookies = res.headers.getSetCookie?.() ?? [];
        for (const c of setCookies) {
            const pair = c.split(";")[0];
            const name = pair.split("=")[0];
            cookie = cookie.replace(new RegExp(name + "=[^;]*;?"), "") + pair + "; ";
        }
    };

    const page = await fetch(`${BASE}/login`, {
        redirect: "manual",
        headers: { ...BROWSER_HEADERS, Cookie: buildCookie("") },
    });
    grab(page);
    const pageText = await page.text();
    const $ = cheerio.load(pageText);
    const token = $('input[name="_token"]').attr("value") ?? "";

    if (!token) {
        throw new Error(
            "Halaman login tanpa CSRF token (kemungkinan challenge Cloudflare). " +
            "Set env CF_CLEARANCE (copy dari browser)."
        );
    }

    const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: {
            ...BROWSER_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: buildCookie(cookie),
        },
        body: new URLSearchParams({ _token: token, email: EMAIL, password: PASSWORD }),
        redirect: "manual",
    });
    grab(res);

    const location = res.headers.get("location") ?? "";
    if (res.status === 419 || (res.status >= 300 && res.status < 400 && location.includes("/login"))) {
        throw new Error("Login anekadropship gagal (kredensial ditolak atau sesi diblokir).");
    }
    return cookie;
}

async function fetchPage(url, cookie) {
    const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: buildCookie(cookie) } });
    return res.text();
}

// ─── Parse helpers (meniru anekadropship.ts) ───────────────────────────────
function cleanProductName(raw) {
    let s = (raw || "").replace(/\s+/g, " ").trim();
    s = s.replace(/^\s*(?:\[[^\]]*\]\s*)+/, "");
    s = s.replace(/\b(?:META\s*ADS(?:\s*ONLY)?|ADS\s*ONLY)\b/gi, " ");
    s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
    s = s.replace(/\s{2,}/g, " ").trim();
    return s || raw.trim();
}

function parseWeightToGram(s) {
    if (!s) return null;
    const m = s.trim().replace(/\s+/g, " ").match(/^([\d.,]+)(?:\s*([a-z]+))?$/i);
    if (!m) return null;
    const raw = m[1];
    let num;
    if (raw.includes(",")) num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) num = parseFloat(raw.replace(/\./g, ""));
    else num = parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    const unit = (m[2] ?? "").toLowerCase();
    if (unit.startsWith("kg")) return Math.round(num * 1000);
    if (unit.startsWith("ons")) return Math.round(num * 100);
    return Math.round(num);
}

function parseVolumeToCm(vol) {
    // "7 x 7 x 23 CM" -> [7,7,23]; else null
    if (!vol) return null;
    const m = vol.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
    if (!m) return null;
    const nums = [m[1], m[2], m[3]].map((v) => Math.round(parseFloat(v.replace(",", "."))));
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
    return nums; // [panjang, lebar, tinggi]
}

function htmlToText(html) {
    if (!html) return "";
    const $ = cheerio.load(html);
    // replace <br> & blocks with newlines
    $("br").replaceWith("\n");
    $("p,div,li,h1,h2,h3,h4,h5,tr").each(function () {
        $(this).append("\n");
    });
    let text = $.text();
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n")
        .trim();
    return text;
}

// ─── Sanitasi deskripsi (pedoman konten marketplace) ───────────────────────
// Reviewer Blibli menolak deskripsi yang memuat: disclaimer "kerusakan"/
// liabilitas, instruksi upload internal (META ADS, "Panduan Aman Upload",
// "marketing kit"), ajakan menyamarkan brand, manipulasi ulasan, dan sebutan
// marketplace lain (shopee/lazada/tokopedia = kata terlarang di sistem Blibli).
// Baris yang seluruhnya berisiko dibuang; pola tertentu dipotong per-kalimat
// agar info lain di baris yang sama tetap aman.
const DESC_DROP_LINE = [
    /META ADS/i,
    /panduan aman upload/i,
    /pelanggaran high quality \(hq\)|duplikasi produk/i,
    /modifikasi judul & deskripsi|lakukan parafrase/i,
    /variasi visual gambar|edit ulang gambar produk/i,
    /marketing kit/i,
    /di luar tanggung jawab/i,
    /shopee|lazada|tokopedia|bukalapak|jd\.id|zalora|traveloka/i,
    /ulasan positif|review positif|penilaian terbaik|jangan lupa|lupakan untuk|untuk pelayanan kami/i,
];
const DESC_DROP_SENTENCE = [/video unboxing/i, /kerusakan akibat ekspedisi/i, /upload di marketplace/i];

function sanitizeDescText(text) {
    if (!text) return text;
    const out = [];
    for (let line of String(text).split("\n")) {
        // Klausa menyatu "packing aman ... kerusakan akibat ekspedisi " -> sisakan bagian packing
        if (/kerusakan akibat ekspedisi/i.test(line) && /packing aman/i.test(line)) {
            line = line.replace(/\s*[,.]?\s*(namun|dan)?\s*kerusakan akibat ekspedisi[^.]*\.?\s*$/i, "").trim();
            if (line && !/[.!]$/.test(line)) line += ".";
            if (line) out.push(line);
            continue;
        }
        if (DESC_DROP_LINE.some((re) => re.test(line))) continue;
        if (DESC_DROP_SENTENCE.some((re) => re.test(line))) {
            const kept = line
                .split(/(?<=[.!?])\s+/)
                .filter((s) => s.trim() && !DESC_DROP_SENTENCE.some((re) => re.test(s)));
            line = kept.join(" ").trim();
            if (!line) continue;
        }
        out.push(line);
    }
    return out.join("\n").replace(/\n{2,}/g, "\n").trim();
}

function parseVariants(html) {
    const m = html.match(/x-data="productActionDetail\(([^"]+)\)"/);
    if (!m) return [];
    const clean = m[1]
        .replace(ENT_QUOT, '"')
        .replace(ENT_AMP, "&")
        .replace(ENT_GT, ">")
        .replace(ENT_LT, "<");
    const braceStart = clean.indexOf("{");
    const braceEnd = clean.lastIndexOf("}");
    if (braceStart < 0 || braceEnd <= braceStart) return [];
    let data;
    try {
        data = JSON.parse(clean.slice(braceStart, braceEnd + 1));
    } catch {
        return [];
    }
    const raw = Array.isArray(data?.variants) ? data.variants : [];
    return raw
        .filter((v) => v?.is_active !== false)
        .map((v) => ({
            name: String(v?.name ?? v?.label ?? "").trim(),
            color: v?.color == null ? null : String(v.color).trim(),
            size: v?.size == null ? null : String(v.size).trim(),
            price: String(v?.price ?? ""),
            stock: Number(v?.stock ?? 0),
        }));
}

function extractAfter($, label) {
    let val = "";
    $("span, div, p, td").each((_, el) => {
        const t = $(el).text().trim().replace(/\s+/g, " ");
        if (t.length < 60 && t.includes(label)) {
            val = t.split(label)[1]?.trim() ?? "";
            return false;
        }
    });
    return val;
}

async function scrapeProductDetail(id, cookie) {
    const url = `${BASE}/products/${id}`;
    let html = await fetchPage(url, cookie);
    if (html.includes("Login ke akun Anda")) {
        // session expired — caller re-login & retry once
        throw { code: "RELOGIN" };
    }
    const $ = cheerio.load(html);
    const name = cleanProductName($("h1").first().text());

    const images = [];
    $('img[src*="/uploads/products"]').each((_, el) => {
        const src = $(el).attr("src") ?? "";
        if (src && !images.includes(src)) images.push(src);
    });

    const descHtml = $(".deskripsi-produk").first().html() ?? "";
    const description = htmlToText(descHtml).slice(0, 4000);

    const berat = extractAfter($, "Berat:");
    const volume = extractAfter($, "Volume:");
    const sku = $("[data-sku]").first().attr("data-sku") ?? "";
    const variants = parseVariants(html);

    const beratGram = parseWeightToGram(berat);
    const dims = parseVolumeToCm(volume);

    return {
        id,
        name,
        images,
        description,
        berat,
        beratGram,
        volume,
        dims,
        sku,
        variants,
        hasVariants: variants.length > 1,
    };
}

// ─── Price / stock parsing ─────────────────────────────────────────────────
function parsePriceToNumber(rp) {
    if (!rp) return 0;
    const digits = String(rp).replace(/[^\d]/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
}

function parseStockNumber(stok) {
    if (!stok) return 0;
    const digits = String(stok).replace(/[^\d]/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
}

// ─── Inferensi axis varian dari nama (varian tanpa color/size terstruktur) ──
// "Varian" bukan atribut resmi kategori -> Blibli menolak dgn error "Varian
// yang sama tidak dapat dibuat untuk pickup point yang sama". Nama diparse
// jadi Warna/Ukuran (mis. "Hitam Size S", "CLS7 Hitam - 39", "M (LD 105 cm)").
const SIZE_TOKENS = new Set([
    "xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "2xl", "3xl", "4xl", "5xl",
    "allsize", "all size", "all size m", "one size", "onesize", "free size",
    "freesize", "jumbo", "fitall", "plus size", "big size",
]);
function isSizeTok(tok) {
    const s = String(tok || "").trim().toLowerCase().replace(/[.,]$/, "");
    if (!s) return false;
    if (SIZE_TOKENS.has(s)) return true;
    return /^\d{2}$/.test(s); // mis. 39-45 (sepatu), 42/43 (anak)
}
function inferVariantAxes(rawName) {
    const s = String(rawName || "").trim();
    let size = "";
    let color = "";
    const mParen = s.match(/^([A-Za-z0-9]+)\s*\(([^)]*)\)$/);
    const mDash = s.match(/^(.*?)\s+-\s+(\S+)$/);
    const mSize = s.match(/^(.*?)\bsize\b\s+(\S+)$/i);
    if (mParen && isSizeTok(mParen[1])) size = mParen[1];
    else if (mDash && isSizeTok(mDash[2])) { size = mDash[2]; color = mDash[1]; }
    else if (mSize && isSizeTok(mSize[2])) { size = mSize[2]; color = mSize[1]; }
    else {
        const toks = s.split(/\s+/);
        if (toks.length === 1 && isSizeTok(toks[0])) size = toks[0];
        else if (toks.length > 1 && isSizeTok(toks[toks.length - 1])) {
            size = toks[toks.length - 1];
            color = toks.slice(0, -1).join(" ");
        } else if (toks.length > 1 && isSizeTok(toks[0])) {
            size = toks[0];
            color = toks.slice(1).join(" ");
        } else color = s;
    }
    // Buang kode model di depan warna (mis. "CLS7 Hitam" -> "Hitam") dan
    // daftar warna campur (mis. "Hitam | Pink | ...") yang bukan satu warna.
    color = color.replace(/\s+/g, " ").trim().replace(/^((?=[^\s]*[a-z])(?=[^\s]*\d)[a-z0-9]{2,10}\s+)+/i, "");
    if (color.includes("|") || (color.match(/,/g) || []).length >= 3) color = "";
    return { size: size.trim(), color };
}

// ─── Build rows for the "Template Upload" sheet ────────────────────────────
function buildRows(products, details, imageMap, locToPp) {
    const rows = [];
    let skipped = 0;
    const ppCounts = {};
    const unmapped = new Set();

    for (const p of products) {
        const d = details[p.id] || {};
        const images = (imageMap[p.id] || [p.image]).filter(Boolean);
        const fullUrls = images.map((img) =>
            /^https?:\/\//i.test(img) ? img : SITE_URL + img
        );

        const dims = d.dims || [10, 10, 10];
        const beratGram = d.beratGram || 500;
        const price = parsePriceToNumber(d.price || p.rekomendasiJual);
        const stock = d.stock != null ? d.stock : parseStockNumber(p.stok);

        if (!price && !stock) skipped++;

        const name = d.name || p.name;
        const sku = d.sku || `KTD-${p.id}`;
        const category = mapCategory(name);
        const cnPath = category.split(" > ").join("->");
        const loc = (p.location || "").trim();
        const ppCode = locToPp[loc] || DEFAULT_PICKUP_POINT;
        if (!locToPp[loc]) unmapped.add(loc || "(kosong)");
        ppCounts[ppCode] = (ppCounts[ppCode] || 0) + 1;

        // Varian: satu baris per varian, digabung oleh "Kode Grup Varian".
        // Axis ditentukan per PRODUK (bukan per baris) agar kolom Nama/Opsi
        // Varian 1&2 konsisten seluruh grup: Warna+Ukuran (2 axis), Warna saja,
        // Ukuran saja, atau label tunggal ("Varian").
        // Harga SEMUA baris = harga produk (rekomendasiJual) — toko memakai satu
        // harga untuk semua varian; harga dari aneka bukan harga jual kita.
        // Seller SKU tiap baris diberi suffix urut agar unik.
        const variantRows = [];
        if (d.hasVariants && d.variants && d.variants.length > 0) {
            const hasColor = d.variants.some((v) => v.color);
            const hasSize = d.variants.some((v) => v.size);
            // Data Warna/Ukuran dari sumber sering kosong (hanya ada nama).
            // Axis "Varian" DITOLAK Blibli, jadi bila salah satu axis tidak
            // terstruktur, namanya diparse jadi Warna/Ukuran.
            const inf = d.variants.map((v) => inferVariantAxes(v.name || ""));
            const pairCol = d.variants.map((v, i) => v.color || inf[i].color || "");
            const pairSize = d.variants.map((v, i) => v.size || inf[i].size || "");
            const allColor = pairCol.every(Boolean);
            const allSize = pairSize.every(Boolean);
            let useColor, useSize;
            if (hasColor && hasSize) { useColor = true; useSize = true; }
            else if (hasColor) { useColor = true; useSize = allSize; }
            else if (hasSize) { useSize = true; useColor = allColor; }
            else { useColor = allColor; useSize = allSize; if (!useColor && !useSize) useColor = true; }
            if (!hasColor && !hasSize) inferredNameProducts++;
            d.variants.forEach((v, i) => {
                let namaVarian1 = "", opsiVarian1 = "", namaVarian2 = "", opsiVarian2 = "";
                if (useColor && useSize) {
                    namaVarian1 = "Warna";
                    opsiVarian1 = pairCol[i] || v.name || "";
                    namaVarian2 = "Ukuran";
                    opsiVarian2 = pairSize[i] || "";
                } else if (useColor) {
                    namaVarian1 = "Warna";
                    opsiVarian1 = pairCol[i] || v.name || "";
                } else {
                    namaVarian1 = "Ukuran";
                    opsiVarian1 = pairSize[i] || v.name || "";
                }
                // Nilai opsi diselaraskan dengan enum resmi kategori (jika ada)
                // supaya lolos validasi atribut Blibli (mis. "M" -> "International - M").
                if (namaVarian1) opsiVarian1 = mapVariantValue(cnPath, namaVarian1, opsiVarian1);
                if (namaVarian2) opsiVarian2 = mapVariantValue(cnPath, namaVarian2, opsiVarian2);
                variantRows.push({
                    sku: `${sku}-${i + 1}`.slice(0, 50),
                    namaVarian1,
                    opsiVarian1,
                    namaVarian2,
                    opsiVarian2,
                    harga: price,
                    stock: v.stock,
                });
            });
            // Kombinasi (axis+opsi) yang tetap kembar digabung stoknya supaya
            // Blibli tidak menolak dgn "Varian yang sama tidak dapat dibuat...".
            const seenCombo = new Map();
            for (const vr of variantRows) {
                const key = [vr.namaVarian1, vr.opsiVarian1, vr.namaVarian2, vr.opsiVarian2].join("|");
                const prev = seenCombo.get(key);
                if (prev) {
                    prev.stock = (Number(prev.stock) || 0) + (Number(vr.stock) || 0);
                    dedupeMergedRows++;
                } else seenCombo.set(key, vr);
            }
            const finalRows = [...seenCombo.values()];
            finalRows.forEach((vr, i) => {
                vr.sku = `${sku}-${i + 1}`.slice(0, 50);
            });
            variantRows.length = 0;
            variantRows.push(...finalRows);
        } else {
            variantRows.push({ sku, namaVarian1: "", opsiVarian1: "", namaVarian2: "", opsiVarian2: "", harga: price, stock });
        }

        // Satu "produk" = semua baris varian share kode grup varian yang sama.
        variantRows.forEach((vr, idx) => {
            const row = {
                Kategori: category,
                "Nama Produk": name,
                Deskripsi: sanitizeDescText(d.description) || `Produk: ${name}`,
                "Model/EAN/UPC": "",
                "Seller SKU": vr.sku || sku,
                "Merek": "No Brand",
                "Kode Panduan Ukuran": "",
                "Kode Grup Varian": d.hasVariants ? `V-${p.id}` : "",
                "Nama Varian 1": vr.namaVarian1,
                "Opsi Varian 1": vr.opsiVarian1,
                "Foto Varian 1": "",
                "Nama Varian 2": vr.namaVarian2,
                "Opsi Varian 2": vr.opsiVarian2,
                "Kode Toko/Gudang": ppCode,
                "Harga Penjualan (Rp)": vr.harga,
                Stok: vr.stock,
                "Status Pengiriman": 1,
                "Foto Utama": fullUrls[0] || "",
                "Foto-2": fullUrls[1] || "",
                "Foto-3": fullUrls[2] || "",
                "Foto-4": fullUrls[3] || "",
                "Foto-5": fullUrls[4] || "",
                "Foto-6": fullUrls[5] || "",
                "Foto-7": fullUrls[6] || "",
                "URL Video": "",
                "Tipe Penanganan": "",
                "Panjang (cm)": dims[0],
                "Lebar (cm)": dims[1],
                "Tinggi (cm)": dims[2],
                "Berat (gram)": beratGram,
                "Spesifikasi 1": "",
                "Isi Spesifikasi 1": "",
                "Spesifikasi 2": "",
                "Isi Spesifikasi 2": "",
                "Spesifikasi 3": "",
                "Isi Spesifikasi 3": "",
                "Spesifikasi 4": "",
                "Isi Spesifikasi 4": "",
                "Spesifikasi 5": "",
                "Isi Spesifikasi 5": "",
            };
            rows.push(row);
        });
    }

    return { rows, skipped, ppCounts, unmapped };
}

// ─── ZIP-level XLSX manipulation (preserves template byte-for-byte) ────────

/** Read a ZIP file into {name, data} entries. */
function readZip(buf) {
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Not a valid ZIP file");
    const cdCount = buf.readUInt16LE(eocd + 10);
    const cdOffset = buf.readUInt32LE(eocd + 16);
    const entries = [];
    let p = cdOffset;
    for (let i = 0; i < cdCount; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Bad central directory entry");
        const method = buf.readUInt16LE(p + 10);
        const compSize = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const localOff = buf.readUInt32LE(p + 42);
        const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
        const lnameLen = buf.readUInt16LE(localOff + 26);
        const lextraLen = buf.readUInt16LE(localOff + 28);
        const dataStart = localOff + 30 + lnameLen + lextraLen;
        const comp = buf.slice(dataStart, dataStart + compSize);
        const data = method === 0 ? comp : zlib.inflateRawSync(comp);
        entries.push({ name, method, data });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

/** Write entries back to a ZIP buffer. */
function writeZip(entries) {
    const parts = [];
    const cd = [];
    let offset = 0;
    for (const e of entries) {
        const nameBuf = Buffer.from(e.name, "utf8");
        const comp = e.method === 0 ? e.data : zlib.deflateRawSync(e.data);
        const crc = zlib.crc32(e.data) >>> 0;
        const local = Buffer.alloc(30 + nameBuf.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 flag
        local.writeUInt16LE(e.method, 8);
        local.writeUInt32LE(0, 10); // mod time/date
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(comp.length, 18);
        local.writeUInt32LE(e.data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        nameBuf.copy(local, 30);
        parts.push(local, comp);
        const cde = Buffer.alloc(46 + nameBuf.length);
        cde.writeUInt32LE(0x02014b50, 0);   // signature
        cde.writeUInt16LE(20, 4);           // version made by
        cde.writeUInt16LE(20, 6);           // version needed
        cde.writeUInt16LE(0x0800, 8);       // flags (UTF-8)
        cde.writeUInt16LE(e.method, 10);    // method
        cde.writeUInt32LE(0, 12);           // mod time + date
        cde.writeUInt32LE(crc, 16);         // crc-32
        cde.writeUInt32LE(comp.length, 20); // compressed size
        cde.writeUInt32LE(e.data.length, 24); // uncompressed size
        cde.writeUInt16LE(nameBuf.length, 28); // file name length
        cde.writeUInt16LE(0, 30);           // extra field length
        cde.writeUInt16LE(0, 32);           // comment length
        cde.writeUInt16LE(0, 34);           // disk number start
        cde.writeUInt16LE(0, 36);           // internal attrs
        cde.writeUInt32LE(0, 38);           // external attrs
        cde.writeUInt32LE(offset, 42);      // local header offset
        nameBuf.copy(cde, 46);
        cd.push(cde);
        offset += 30 + nameBuf.length + comp.length;
    }
    const cdBuf = Buffer.concat(cd);
    const cdStart = offset;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12);
    eocd.writeUInt32LE(cdStart, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...parts, cdBuf, eocd]);
}

/** Escape XML text content. */
function xmlEscape(s) {
    return String(s)
        .replace(/&/g, XML_AMP)
        .replace(/</g, XML_LT)
        .replace(/>/g, XML_GT)
        .replace(/\x00/g, "");
}

/** Excel column letter for a 1-indexed column number (1=A, 2=B, ... 43=AQ). */
function colLetter(n) {
    let s = "";
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function writeExcel(rows, plan) {
    const TEMPLATE_PATH = path.join(OUTPUT_DIR, "Blibli_general_upload_template_v2.0.xlsx");
    const buf = fs.readFileSync(TEMPLATE_PATH);
    const entries = readZip(buf);

    const sheetEntry = entries.find((e) => e.name === "xl/worksheets/sheet2.xml");
    if (!sheetEntry) throw new Error("Template Upload sheet (sheet2.xml) not found");

    const sheetXml = sheetEntry.data.toString("utf8");

    // ── Shared strings ──────────────────────────────────────────────────
    // Parser backend Blibli hanya mengekstrak elemen <v>; cell t="inlineStr"
    // (tanpa <v>) dianggap KOSONG (terbukti dari file error konversi mereka).
    // Maka semua cell teks ditulis t="s" + <v>index</v> seperti template asli:
    // string baru di-append ke sharedStrings.xml + update count/uniqueCount.
    const sstEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
    if (!sstEntry) throw new Error("sharedStrings.xml not found");
    const sstBaseXml = sstEntry.data.toString("utf8");
    const sstOpenTag = sstBaseXml.match(/<sst\b[^>]*>/)[0];
    const sstBaseCount = Number((sstOpenTag.match(/\scount="(\d+)"/) || [])[1] ?? NaN);
    const sstBaseUnique = Number((sstOpenTag.match(/\suniqueCount="(\d+)"/) || [])[1] ?? NaN);
    const sstBaseSiCount = sstBaseXml.split("</si>").length - 1;
    const newSis = [];
    const siIndex = new Map();
    let sstNewRefs = 0;
    const sharedStringIndex = (text) => {
        if (siIndex.has(text)) return siIndex.get(text);
        const idx = sstBaseSiCount + newSis.length;
        newSis.push(`<si><t xml:space="preserve">${xmlEscape(text)}</t></si>`);
        siIndex.set(text, idx);
        return idx;
    };
    /** Cell teks -> shared string (t="s" + <v>), style opsional. */
    const textCell = (ref, text, style) => {
        sstNewRefs++;
        const s = style ? ` s="${style}"` : "";
        return `<c r="${ref}" t="s"${s}><v>${sharedStringIndex(text)}</v></c>`;
    };

    // Data starts at Excel row 11. Column A is empty; data columns are B..AQ.
    // vals[] order: 0=KatL1, 1=KatL2, 2=KatL3, 3=Nama, 4=Deskripsi, 5=Model,
    // 6=SKU, 7=Merek, 8=PanduanUkuran, 9=GrupVarian, 10=NamaV1, 11=OpsiV1,
    // 12=FotoV1, 13=NamaV2, 14=OpsiV2, 15=KodeToko, 16=Harga, 17=Stok,
    // 18=Status, 19=FotoUtama, 20..25=Foto2..7, 26=URLVideo, 27=TipePenanganan,
    // 28=Panjang, 29=Lebar, 30=Tinggi, 31=Berat, 32..41=Spesifikasi1..Isi5.
    // Physical column (1-indexed) = vals index + 2  (A=1 empty, B=2 ...).
    const DATA_START_ROW = 11;
    const NUMERIC_VALS_IDX = new Set([16, 17, 18, 28, 29, 30, 31]);

    const rowXmls = [];
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const cat = (r.Kategori || "").split(" > ").map((s) => s.trim());
        const vals = [
            cat[0] || "", cat[1] || "", cat[2] || "",
            r["Nama Produk"], r.Deskripsi, r["Model/EAN/UPC"], r["Seller SKU"], r.Merek,
            r["Kode Panduan Ukuran"], r["Kode Grup Varian"],
            r["Nama Varian 1"], r["Opsi Varian 1"], r["Foto Varian 1"],
            r["Nama Varian 2"], r["Opsi Varian 2"],
            r["Kode Toko/Gudang"], r["Harga Penjualan (Rp)"], r.Stok, r["Status Pengiriman"],
            r["Foto Utama"], r["Foto-2"], r["Foto-3"], r["Foto-4"], r["Foto-5"], r["Foto-6"], r["Foto-7"],
            r["URL Video"], r["Tipe Penanganan"],
            r["Panjang (cm)"], r["Lebar (cm)"], r["Tinggi (cm)"], r["Berat (gram)"],
            r["Spesifikasi 1"], r["Isi Spesifikasi 1"], r["Spesifikasi 2"], r["Isi Spesifikasi 2"],
            r["Spesifikasi 3"], r["Isi Spesifikasi 3"], r["Spesifikasi 4"], r["Isi Spesifikasi 4"],
            r["Spesifikasi 5"], r["Isi Spesifikasi 5"],
        ];

        const rowNum = DATA_START_ROW + i;
        const cells = [];
        for (let c = 0; c < vals.length; c++) {
            const text = String(vals[c] ?? "");
            if (text === "" || text === "undefined") continue;
            const ref = colLetter(c + 2) + rowNum;
            if (NUMERIC_VALS_IDX.has(c)) {
                const n = Number(text);
                cells.push(`<c r="${ref}"><v>${Number.isFinite(n) ? n : 0}</v></c>`);
            } else {
                cells.push(textCell(ref, text));
            }
        }
        rowXmls.push(`<row r="${rowNum}" spans="1:43" x14ac:dyDescent="0.2">${cells.join("")}</row>`);
    }

    // Insert data rows before </sheetData>
    const sheetDataClose = sheetXml.lastIndexOf("</sheetData>");
    if (sheetDataClose < 0) throw new Error("sheet2.xml has no </sheetData>");
    let newSheetXml =
        sheetXml.slice(0, sheetDataClose) + rowXmls.join("") + sheetXml.slice(sheetDataClose);

    // Update dimension ref to cover data rows
    const lastRow = DATA_START_ROW + rows.length - 1;
    newSheetXml = newSheetXml.replace(
        /<dimension ref="[^"]*"/,
        `<dimension ref="A4:AR${lastRow}"`
    );

    sheetEntry.data = Buffer.from(newSheetXml, "utf8");

    // Update sheet "Toko" (xl/worksheets/sheet11.xml): daftar semua pickup point.
    const tokoEntry = entries.find((e) => e.name === "xl/worksheets/sheet11.xml");
    if (tokoEntry) {
        const pickups = [...plan.existing, ...plan.new];
        const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dNow = new Date();
        const tglToko = `${dNow.getDate()}-${MONTHS[dNow.getMonth()]}-${String(dNow.getFullYear()).slice(-2)}`;
        const tr = [];
        tr.push(`<row r="1">${textCell("A1", "List Alamat Pengambilan /Pickup Point/Gudang", 128)}</row>`);
        tr.push(`<row r="2">${textCell("A2", "update per tanggal")}${textCell("B2", tglToko)}</row>`);
        tr.push(
            `<row r="4">${textCell("A4", "Kode Pickup Point/Gudang", 126)}${textCell("B4", "Nama Pickup Point/Gudang", 126)}${textCell("C4", "Kode Pickup Point/Gudang || Nama Pickup Point/Gudang", 126)}</row>`
        );
        pickups.forEach((pk, i) => {
            const rr = 5 + i;
            tr.push(
                `<row r="${rr}">${textCell(`A${rr}`, pk.ppCode, 127)}${textCell(`B${rr}`, pk.name, 127)}${textCell(`C${rr}`, `${pk.ppCode} || ${pk.name}`, 127)}</row>`
            );
        });
        let tokoXml = tokoEntry.data.toString("utf8");
        tokoXml = tokoXml.replace(/<sheetData>[\s\S]*<\/sheetData>/, `<sheetData>${tr.join("")}</sheetData>`);
        tokoXml = tokoXml.replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:D${4 + pickups.length}"`);
        tokoEntry.data = Buffer.from(tokoXml, "utf8");
    }

    // Finalisasi sharedStrings.xml: append string baru + update count/uniqueCount.
    if (newSis.length) {
        const finalCount = (Number.isFinite(sstBaseCount) ? sstBaseCount : sstBaseSiCount) + sstNewRefs;
        const finalUnique = (Number.isFinite(sstBaseUnique) ? sstBaseUnique : sstBaseSiCount) + newSis.length;
        let sstXml = sstBaseXml.replace("</sst>", newSis.join("") + "</sst>");
        sstXml = sstXml.replace(/<sst\b[^>]*>/, (tag) => {
            let t = tag;
            t = /\scount="\d+"/.test(t)
                ? t.replace(/\scount="\d+"/, ` count="${finalCount}"`)
                : t.replace(/>$/, ` count="${finalCount}">`);
            t = /\suniqueCount="\d+"/.test(t)
                ? t.replace(/\suniqueCount="\d+"/, ` uniqueCount="${finalUnique}"`)
                : t.replace(/>$/, ` uniqueCount="${finalUnique}">`);
            return t;
        });
        sstEntry.data = Buffer.from(sstXml, "utf8");
    }

    const outBuf = writeZip(entries);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, outBuf);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log("=== Build Blibli Mass Upload ===\n");

    // 1. Load product list + image map
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    let products = cache.products || [];
    const imageMap = JSON.parse(fs.readFileSync(IMG_MAP_PATH, "utf8"));
    console.log(`Produk ditemukan: ${products.length}`);

    // Mode inkremental: --ids-file=... -> proses hanya id terdaftar (file ADD baru).
    if (IDS_FILE) {
        const ids = JSON.parse(fs.readFileSync(IDS_FILE, "utf8"));
        const set = new Set(ids.map(String));
        products = products.filter((p) => set.has(String(p.id)));
        if (products.length !== set.size) {
            const found = new Set(products.map((p) => String(p.id)));
            const missing = [...set].filter((id) => !found.has(id));
            throw new Error(`--ids-file: ${missing.length} id tidak ada di katalog: ${missing.slice(0, 10).join(", ")}`);
        }
        console.log(`Filter --ids-file: ${products.length} produk diproses`);
    }

    // 2. Load or scrape detail
    let details = {};
    if (fs.existsSync(DETAIL_CACHE_FILE)) {
        try {
            details = JSON.parse(fs.readFileSync(DETAIL_CACHE_FILE, "utf8"));
            console.log(`Detail cache ter-load: ${Object.keys(details).length} produk`);
        } catch { /* ignore */ }
    }

    if (!NO_SCRAPE) {
        let cookie = "";
        try {
            cookie = await login();
            console.log("Login anekadropship berhasil.");
        } catch (e) {
            console.error(`\n⚠️  Login gagal: ${e.message}`);
            console.error("    Lanjut generate dari data lokal (tanpa deskripsi/berat/dimensi).\n");
        }

        if (cookie) {
            let done = 0;
            for (const p of products) {
                if (details[p.id] && details[p.id].description) {
                    done++;
                    continue;
                }
                try {
                    const d = await scrapeProductDetail(p.id, cookie);
                    if (d.name || d.description) details[p.id] = d;
                } catch (e) {
                    if (e && e.code === "RELOGIN") {
                        // re-login sekali
                        try {
                            cookie = await login();
                            const d = await scrapeProductDetail(p.id, cookie);
                            if (d.name || d.description) details[p.id] = d;
                        } catch { /* skip */ }
                    }
                    // transient error -> skip, keep going
                }
                done++;
                if (done % 20 === 0) {
                    console.log(`  Scraped ${done}/${products.length}`);
                    fs.writeFileSync(DETAIL_CACHE_FILE, JSON.stringify(details, null, 2));
                }
                await sleep(DELAY_MS);
            }
            fs.writeFileSync(DETAIL_CACHE_FILE, JSON.stringify(details, null, 2));
            console.log(`Detail di-scrape: ${Object.keys(details).length} produk`);
        }
    }

    // Mode inkremental: tolak build kalau masih ada detail yang belum lengkap —
    // file ADD harus berisi deskripsi/berat/dimensi/varian yang valid.
    if (IDS_FILE) {
        const pending = products.filter((p) => !details[p.id] || !details[p.id].description);
        if (pending.length) {
            throw new Error(
                `Mode --ids-file: ${pending.length} produk belum berdetail lengkap ` +
                `(contoh: ${pending.slice(0, 8).map((p) => p.id).join(", ")}) — ` +
                "perbaiki login anekadropship lalu jalankan ulang (resume cache)."
            );
        }
    }

    // 3. Load pickup plan (lokasi seller -> kode PP Blibli)
    const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
    const locToPp = {};
    for (const e of plan.existing) for (const l of e.location) locToPp[l] = e.ppCode;
    for (const e of plan.new) for (const l of e.location) locToPp[l] = e.ppCode;
    console.log(`Pickup plan: ${plan.existing.length + plan.new.length} titik (${Object.keys(locToPp).length} badge lokasi)`);

    // 4. Build rows + write Excel
    const { rows, skipped, ppCounts, unmapped } = buildRows(products, details, imageMap, locToPp);
    writeExcel(rows, plan);

    console.log(`\n✅ Selesai. ${rows.length} baris ditulis.`);
    console.log(`   Produk tanpa harga/stok valid (di-skip sebagian): ${skipped}`);
    console.log(`   Pickup point terpakai: ${Object.keys(ppCounts).length}`);
    console.log(`   Mapping nilai enum varian: ${enumMapped} diselaraskan, ${enumUnmapped} tak terpetakan\n   Axis varian hasil inferensi nama: ${inferredNameProducts} produk; baris kembar digabung: ${dedupeMergedRows}`);
    if (enumUnmappedSamples.length) {
        console.log("   ⚠️  Contoh nilai varian tak terpetakan:");
        for (const s of enumUnmappedSamples) console.log(`      - ${s}`);
    }
    if (unmapped.size) console.log(`   ⚠️  Lokasi tanpa mapping (fallback default): ${[...unmapped].join(", ")}`);
    const noCat = rows.filter((r) => !r.Kategori).map((r) => r["Nama Produk"]);
    if (noCat.length) {
        console.log(`   ⚠️  Kategori kosong (${noCat.length}):`);
        for (const nm of noCat.slice(0, 30)) console.log(`      - ${nm}`);
    }
    console.log(`   Output: ${OUTPUT_FILE}`);
}

main().catch((err) => {
    console.error("FATAL:", err && err.message ? err.message : err);
    process.exit(1);
});
