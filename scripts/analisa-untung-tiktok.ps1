# Analisa margin 100 produk TikTok Shop (tiktok-live-100.json) vs komisi Kolaborasi Terbuka 15% - KTD Store.
# Pemakaian: powershell -ExecutionPolicy Bypass -File scripts\analisa-untung-tiktok.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Join-Path $PSScriptRoot '..'
$live = Get-Content (Join-Path $root 'tiktok-export\tiktok-live-100.json') -Raw | ConvertFrom-Json
$cat  = Get-Content (Join-Path $root 'src\lib\products-cache.json') -Raw | ConvertFrom-Json

function To-Rp([string]$s) {
  $t = ([string]$s).Trim() -replace 'Rp', '' -replace '\s', ''
  if ($t -match '^\d+\.\d{2}$') { $t = ($t -split '\.')[0] }
  $n = ($t -replace '[^0-9]', '')
  if ([string]::IsNullOrEmpty($n)) { return 0 }
  return [int]$n
}

function Norm([string]$s) {
  if ($null -eq $s) { return '' }
  return ($s.ToLower() -replace '[^a-z0-9]', '')
}

# lookup katalog: nama ternormalisasi -> produk
$byNorm = @{}
$allNorms = New-Object System.Collections.Generic.List[object]
foreach ($p in $cat.products) {
  $n = Norm $p.name
  if (-not $byNorm.ContainsKey($n)) { $byNorm[$n] = $p }
  $allNorms.Add([pscustomobject]@{ Norm = $n; P = $p })
}

# Peta manual: nama TikTok (ternormalisasi) -> id katalog. Untuk item yang namanya diubah saat upload di TikTok.
$manualId = @{
  'essenjahatstriker46olahragaoutdoorberkualitas'                    = 65
  'essenlumutr4665mlolahragaoutdoorberkualitas'                      = 63
  'shoescleanerr46olahragaoutdoorberkualitas'                        = 53
  'pembersihsepatuolahragaoutdoorberkualitas'                        = 961
  'pembersihmejaperlengkapanrumahtanggaberkualitas'                  = 958
  'susukacangkedelaibubukmurni1kgsoybeanmilkpowdertinggiprotein'     = 1397
  'susukacangkedelaibubukmurni200grsoybeanmilkpowdertanpagula'       = 1396
  'madubawanghitamtunggal250mlblackgarlichoneyfermentasiherbalalami' = 1235
  'sarilemoncaliforniamurni500mlperasanlemonaslisegartanpapengawet'  = 1395
  'sarilemondetokscalifornia250mljusperasanlemonmurniasliberkualitas'= 1398
  'cukasariapelorganik500mlwithmotherapplecidervinegarmurnialami'    = 1394
}
# Batch SS (tidak punya baris modal di products-cache): modal net = modal coret (blibli-detail-cache) x 0,9 (diskon 10% terbukti di 752/752 produk).
$manualModal = @{
  'terramycinplus10mlobatayampascabertarungobatayamyangterkenajaluobatcrdngorokayamobatayamberakkapur' = 24300
  'lincospec10mlobatsakitayamlincospec20010mlobatsakitayam10ml'                                        = 25200
  'desinfektankandang1literdestanplus1ldesinfektanbkc10aromasegardesinfektan'                          = 37800
  'deltaplus55ec100mlcairanpembasmikutucaplaktungauuntukanjingkucingkandangdanlingkunganhewan'         = 38700
  'alfatox100mlobatkututernakpembasmilarvalalatguremkutuampuh100ml'                                     = 38700
}

$rows = @()
$unmatched = @()
foreach ($t in $live) {
  $jual = To-Rp $t.price
  $key = Norm $t.name
  $p = $null
  $match = ''
  if ($manualId.ContainsKey($key)) {
    $p = @($cat.products | Where-Object { [string]$_.id -eq [string]$manualId[$key] })[0]
    if ($p) { $match = 'manual' }
  }
  if (-not $p) { $p = $byNorm[$key]; if ($p) { $match = 'exact' } }
  if (-not $p -and $key.Length -ge 20) {
    # fallback: prefix cocok dua arah (nama TikTok sering ditambah/kurang kata)
    $k = if ($key.Length -gt 40) { $key.Substring(0, 40) } else { $key }
    $cand = $allNorms | Where-Object {
      $_.Norm.StartsWith($k) -or ($_.Norm.Length -ge 20 -and $k.StartsWith($_.Norm.Substring(0, [math]::Min(30, $_.Norm.Length))))
    } | Sort-Object { -$_.Norm.Length } | Select-Object -First 1
    if ($cand) { $p = $cand.P; $match = 'fuzzy' }
  }
  $modal = if ($manualModal.ContainsKey($key)) { [int]$manualModal[$key] } else { 0 }
  if ($modal -le 0 -and $p) { $modal = To-Rp ([string]$p.hargaModal) }
  if ($modal -le 0) {
    $alasan = if ($p) { 'modal kosong di katalog' } else { 'tidak ketemu di katalog' }
    $unmatched += [pscustomobject]@{ Nama = $t.name; Jual = $jual; Alasan = $alasan }
    continue
  }
  $untung = $jual - $modal
  $persen = [math]::Round($untung * 100.0 / $jual, 1)
  $kom15 = [math]::Round($jual * 0.15)
  $sisa = $untung - $kom15
  $persenSisa = [math]::Round($sisa * 100.0 / $jual, 1)
  $verdict = if ($sisa -le 0) { 'RUGI' } elseif ($persenSisa -lt 10) { 'TIPIS' } else { 'AMAN' }
  $nm = ([string]$t.name).Trim()
  $kn = if ($p) { ([string]$p.name).Trim() } else { '' }
  $rows += [pscustomobject]@{
    ID = if ($p) { $p.id } else { 'SS' }
    Nama = $nm.Substring(0, [math]::Min(52, $nm.Length))
    Jual = $jual; Modal = $modal; Untung = $untung; Persen = $persen
    Kom15 = $kom15; Sisa = $sisa; PersenSisa = $persenSisa; Verdict = $verdict
    Match = $match; Katalog = $kn.Substring(0, [math]::Min(40, $kn.Length))
  }
}

$cols = 'ID', 'Nama', 'Jual', 'Modal', 'Untung', 'Persen', 'Kom15', 'Sisa', 'PersenSisa'
"Total produk live TikTok: {0} | Terpetakan dengan modal: {1} | Tanpa modal: {2}" -f $live.Count, $rows.Count, $unmatched.Count
$rows | Group-Object Match | Sort-Object Name | ForEach-Object { "  peta {0}: {1} produk" -f $_.Name, $_.Count }
if ($rows.Count) {
  "Rata-rata margin kotor (sebelum komisi): {0}%" -f ([math]::Round((($rows | Measure-Object Persen -Average).Average), 1))
  "Median margin kotor: {0}%" -f (@($rows | Sort-Object Persen)[[int]($rows.Count / 2)]).Persen
}
""
"=== JUMLAH PER VERDICT (setelah komisi 15%) ==="
$rows | Group-Object Verdict | Sort-Object Name | ForEach-Object { "{0,-6}: {1} produk" -f $_.Name, $_.Count }
""
$rugi = @($rows | Where-Object Verdict -eq 'RUGI')
$tipis = @($rows | Where-Object Verdict -eq 'TIPIS')
"=== A. RUGI setelah komisi 15% (Sisa <= Rp 0): {0} produk ===" -f $rugi.Count
if ($rugi.Count) { $rugi | Sort-Object Sisa | Format-Table $cols -AutoSize | Out-String -Width 300 }
""
"=== B. TIPIS: sisa margin < 10% dari harga jual: {0} produk ===" -f $tipis.Count
if ($tipis.Count) { $tipis | Sort-Object PersenSisa | Format-Table $cols -AutoSize | Out-String -Width 300 }
""
"=== C. CONTOH AMAN: sisa margin (%) terbesar, 10 teratas ==="
$rows | Where-Object Verdict -eq 'AMAN' | Sort-Object PersenSisa -Descending | Select-Object -First 10 | Format-Table $cols -AutoSize | Out-String -Width 300
""
"=== SIMULASI: 100 produk TERJUAL 1x VIA KREATOR (angka per unit) ==="
"Total omzet   : Rp {0:N0}" -f (($rows | Measure-Object Jual -Sum).Sum)
"Total modal   : Rp {0:N0}" -f (($rows | Measure-Object Modal -Sum).Sum)
"Untung kotor  : Rp {0:N0}" -f (($rows | Measure-Object Untung -Sum).Sum)
"Komisi 15%    : Rp {0:N0}" -f (($rows | Measure-Object Kom15 -Sum).Sum)
"Untung bersih : Rp {0:N0}" -f (($rows | Measure-Object Sisa -Sum).Sum)
""
"=== E. AUDIT PEMETAAN: item hasil fuzzy/manual (verifikasi manual) ==="
$rows | Where-Object { $_.Match -ne 'exact' } | Select-Object ID, Match, Nama, Katalog, Jual, Modal | Format-Table -AutoSize | Out-String -Width 320
""
"=== D. TANPA MODAL / TIDAK KETEMU ({0}) ===" -f $unmatched.Count
if ($unmatched.Count) { $unmatched | Sort-Object Jual -Descending | Format-Table -AutoSize | Out-String -Width 300 }
