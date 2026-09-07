// Static editorial content for the homepage (non-product sections).
// Product + category data now comes from anekadropship.id via /api routes.
// Icons are referenced by a string key and resolved to lucide icons in components.

export type IconKey =
  | "spray"
  | "paw"
  | "sparkles"
  | "home"
  | "party"
  | "cooking"
  | "flashlight"
  | "fish"
  | "tent"
  | "coffee"
  | "mic"
  | "gift";

export const collections: { title: string; icon: IconKey; query: string }[] = [
  { title: "Pembersih & Desinfektan", icon: "spray", query: "pembersih" },
  { title: "Perawatan Hewan", icon: "paw", query: "hewan" },
  { title: "Kecantikan & Perawatan", icon: "sparkles", query: "kecantikan" },
  { title: "Alat Rumah Tangga", icon: "home", query: "rumah tangga" },
];

export type BlogPost = {
  title: string;
  slug: string;
  icon: IconKey;
  date: string;
  query: string;
  image: string;
  excerpt: string;
  content: string[];
};

export const blogPosts: BlogPost[] = [
  {
    title: "Tips Memilih Produk Pembersih Rumah",
    slug: "tips-memilih-produk-pembersih-rumah",
    icon: "spray",
    date: "12 Agu 2026",
    query: "pembersih",
    image: "/images/blog/pembersih.jpg",
    excerpt:
      "Bingung memilih produk pembersih yang tepat? Simak tips memilih pembersih rumah berdasarkan ruangan, bahan, dan keamanan keluarga.",
    content: [
      "Rumah yang bersih bukan hanya soal tampilan, tapi juga kesehatan penghuninya. Namun, dengan begitu banyak produk pembersih di pasaran, memilih yang tepat bisa membingungkan. Berikut beberapa hal yang perlu Anda perhatikan sebelum membeli produk pembersih rumah.",
      "Pertama, kenali kebutuhan setiap ruangan. Pembersih lantai dapur berbeda kebutuhannya dengan pembersih kamar mandi atau kaca. Pembersih dapur sebaiknya mampu mengangkat minyak, sementara pembersih kamar mandi perlu formula anti-jamur dan anti-kerak. Gunakan produk yang memang dirancang untuk permukaan tersebut agar hasilnya maksimal.",
      "Kedua, periksa kandungan bahannya. Jika di rumah ada anak kecil atau hewan peliharaan, pilih produk dengan bahan yang lebih ramah dan tidak meninggalkan residu berbahaya. Produk berbahan alami atau berlabel eco-friendly bisa menjadi alternatif yang lebih aman.",
      "Ketiga, perhatikan jenis permukaan yang akan dibersihkan. Lantai keramik, kayu, marmer, dan vinyl memerlukan perawatan yang berbeda. Menggunakan pembersih yang salah bisa membuat permukaan kusam atau bahkan rusak. Selalu baca label dan petunjuk pemakaian pada kemasan.",
      "Keempat, pertimbangkan efisiensi dan kemasan. Produk dengan takaran yang jelas akan membantu Anda menghemat pemakaian. Kemasan refill juga lebih ekonomis dan ramah lingkungan dibandingkan membeli botol baru setiap kali habis.",
      "Terakhir, baca ulasan dari pengguna lain sebelum membeli. Pengalaman pengguna sering kali memberi gambaran nyata tentang efektivitas produk. Temukan berbagai pilihan produk pembersih rumah berkualitas dengan harga bersaing di toko kami.",
    ],
  },
  {
    title: "Perawatan Hewan Peliharaan di Rumah",
    slug: "perawatan-hewan-peliharaan-di-rumah",
    icon: "paw",
    date: "10 Agu 2026",
    query: "hewan",
    image: "/images/blog/hewan.jpg",
    excerpt:
      "Merawat hewan peliharaan tidak harus selalu ke salon. Pelajari cara memandikan, menyisir bulu, dan merawat kebersihan hewan kesayangan Anda di rumah.",
    content: [
      "Hewan peliharaan adalah bagian dari keluarga, dan merawatnya di rumah bisa menjadi aktivitas yang menyenangkan sekaligus mempererat ikatan. Dengan peralatan yang tepat, Anda bisa melakukan perawatan rutin tanpa harus sering ke pet salon.",
      "Mulailah dengan menyisir bulu secara rutin. Menyisir membantu menghilangkan bulu mati, mencegah kusut, dan melancarkan peredaran darah di kulit. Pilih sisir atau sikat yang sesuai dengan jenis bulu hewan Anda, dan lakukan minimal dua hingga tiga kali seminggu.",
      "Untuk urusan mandi, gunakan sampo khusus hewan, bukan sampo manusia. Kandungan pH kulit hewan berbeda dengan manusia, sehingga sampo manusia bisa membuat kulitnya kering dan gatal. Mandikan hewan dengan air hangat, bilas hingga bersih, lalu keringkan dengan handuk atau hair dryer pada suhu rendah.",
      "Jangan lupakan kebersihan telinga, mata, dan kuku. Bersihkan telinga dengan kapas dan cairan pembersih khusus, potong kuku secara berkala dengan gunting khusus hewan, dan sikat gigi dengan pasta gigi khusus hewan untuk mencegah bau mulut dan karang gigi.",
      "Selain kebersihan tubuh, lingkungan sekitar juga perlu dijaga. Bersihkan kandang, tempat tidur, serta wadah makan dan minum secara rutin untuk mencegah bakteri dan kutu. Sediakan tempat tidur yang nyaman dan mainan untuk menjaga kesehatan mental hewan Anda.",
      "Dengan perawatan yang konsisten di rumah, hewan peliharaan akan lebih sehat, bersih, dan bahagia. Lengkapi kebutuhan perawatan hewan Anda dengan produk-produk pilihan yang tersedia di toko kami.",
    ],
  },
  {
    title: "Rutinitas Perawatan Kulit Wajah",
    slug: "rutinitas-perawatan-kulit-wajah",
    icon: "sparkles",
    date: "08 Agu 2026",
    query: "kecantikan",
    image: "/images/blog/skincare.jpg",
    excerpt:
      "Kulit sehat dimulai dari rutinitas yang konsisten. Kenali urutan skincare dasar yang benar, dari pembersih hingga tabir surya.",
    content: [
      "Memiliki kulit wajah yang sehat tidak selalu membutuhkan produk mahal, melainkan rutinitas yang tepat dan konsisten. Kuncinya adalah memahami tipe kulit Anda — kering, berminyak, kombinasi, atau sensitif — lalu memilih produk yang sesuai.",
      "Langkah pertama adalah membersihkan wajah. Gunakan pembersih wajah yang lembut dua kali sehari, pagi dan malam. Pembersihan malam hari sangat penting untuk mengangkat kotoran, minyak, dan sisa makeup yang menumpuk sepanjang hari.",
      "Setelah wajah bersih, gunakan toner untuk menyeimbangkan pH kulit dan mempersiapkan kulit menerima produk berikutnya. Lanjutkan dengan serum yang mengandung bahan aktif sesuai kebutuhan kulit Anda, seperti niacinamide untuk mencerahkan atau hyaluronic acid untuk hidrasi.",
      "Jangan lupakan pelembap. Pelembap berfungsi menjaga kelembapan kulit dan memperkuat skin barrier, bahkan untuk kulit berminyak sekalipun. Pilih tekstur gel untuk kulit berminyak dan krim untuk kulit kering.",
      "Langkah paling penting yang sering dilewatkan adalah tabir surya. Gunakan sunscreen minimal SPF 30 setiap pagi, meskipun Anda hanya beraktivitas di dalam rumah. Paparan sinar UV adalah penyebab utama penuaan dini dan noda hitam.",
      "Lakukan eksfoliasi satu hingga dua kali seminggu untuk mengangkat sel kulit mati, namun jangan berlebihan karena bisa merusak skin barrier. Ingat, hasil perawatan kulit tidak instan — konsistensi adalah kuncinya. Temukan produk perawatan kulit favorit Anda di toko kami.",
    ],
  },
];

/** Look up a single blog post by its slug (for the article pages). */
export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((b) => b.slug === slug);
}

export const heroSlides: { title: string; subtitle: string; icon: IconKey; image: string }[] = [
  { title: "Alat Rumah Tangga", subtitle: "Kebutuhan harian rumah Anda", icon: "home", image: "/images/hero/party.jpg" },
  { title: "Peralatan Dapur", subtitle: "Perlengkapan memasak lengkap", icon: "cooking", image: "/images/hero/cooking.jpg" },
  { title: "Koleksi Headlamp", subtitle: "Penerangan untuk aktivitas outdoor", icon: "flashlight", image: "/images/hero/flashlight.jpg" },
  { title: "Perlengkapan Memancing", subtitle: "Kotak perkakas pancing", icon: "fish", image: "/images/hero/fish.jpg" },
  { title: "Alat Masak Camping", subtitle: "Peralatan outdoor", icon: "tent", image: "/images/hero/tent.jpg" },
  { title: "Aksesoris Kopi", subtitle: "Wadah ampas kopi", icon: "coffee", image: "/images/hero/coffee.jpg" },
  { title: "Condenser Microphone", subtitle: "Peralatan rekaman", icon: "mic", image: "/images/hero/mic.jpg" },
  { title: "Berbagai Kategori Pilihan", subtitle: "Produk pilihan untuk kebutuhan Anda", icon: "gift", image: "/images/hero/gift.jpg" },
];

export const recentSearches = ["Powerbank", "Lampu LED", "Pembersih", "Kesehatan"];
