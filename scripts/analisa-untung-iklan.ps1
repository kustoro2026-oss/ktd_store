# Analisa produk dengan untung terbesar - untuk pemilihan produk iklan Meta Ads KTD Store.
# Pemakaian: powershell -ExecutionPolicy Bypass -File scripts\analisa-untung-iklan.ps1
$cat = Get-Content (Join-Path $PSScriptRoot '..\src\lib\products-cache.json') -Raw | ConvertFrom-Json

function To-Rp([string]$s) {
  $t = ([string]$s).Trim() -replace 'Rp', '' -replace '\s', ''
  if ($t -match '^\d+\.\d{2}$') { $t = ($t -split '\.')[0] }
  $n = ($t -replace '[^0-9]', '')
  if ([string]::IsNullOrEmpty($n)) { return 0 }
  return [int]$n
}

function Get-Terjual([object]$t) {
  if ($null -eq $t) { return 0 }
  $s = ([string]$t).ToLower().Trim()
  $mult = 1
  if ($s -match 'rb|ribu') { $mult = 1000 }
  $s = $s -replace '[^0-9,\.]', ''
  if ([string]::IsNullOrEmpty($s)) { return 0 }
  if ($s -match ',') { $s = $s.Replace('.', '').Replace(',', '.') }
  elseif ($s -match '\.\d{3}$') { $s = $s.Replace('.', '') }
  try { return [int]([double]$s * $mult) } catch { return 0 }
}

$rows = foreach ($p in $cat.products) {
  $jual  = To-Rp (($p.rekomendasiJual -split '/')[0])
  $modal = To-Rp (($p.hargaModal -split '/')[0])
  if ($jual -le 0 -or $modal -le 0 -or $modal -ge $jual) { continue }
  $nama = ([string]$p.name).Trim()
  [pscustomobject]@{
    ID      = $p.id
    Nama    = $nama.Substring(0, [math]::Min(46, $nama.Length))
    Jual    = $jual
    Modal   = $modal
    Untung  = $jual - $modal
    Persen  = [math]::Round(($jual - $modal) * 100.0 / $jual)
    Terjual = Get-Terjual $p.terjual
    Stok    = $p.stok
    Berat   = ([string]$p.beratGram).Trim()
  }
}

"Total produk dianalisa: {0}" -f @($rows).Count

'=== A. TOP 40 UNTUNG TERBESAR (Rp per unit) ==='
$rows | Sort-Object Untung -Descending | Select-Object -First 40 |
  Format-Table ID, Nama, Jual, Modal, Untung, Persen, Terjual, Stok, Berat -AutoSize |
  Out-String -Width 400

'=== B. TOP 30 TERJUAL TERBANYAK DI ANTARA UNTUNG >= Rp 40.000 (laku + untung besar) ==='
$rows | Where-Object { $_.Untung -ge 40000 } | Sort-Object Terjual -Descending | Select-Object -First 30 |
  Format-Table ID, Nama, Jual, Modal, Untung, Persen, Terjual, Stok, Berat -AutoSize |
  Out-String -Width 400

'=== C. SWEET SPOT: HARGA <= Rp 150.000 & UNTUNG >= Rp 30.000 (urut untung) ==='
$rows | Where-Object { $_.Jual -le 150000 -and $_.Untung -ge 30000 } | Sort-Object Untung -Descending | Select-Object -First 30 |
  Format-Table ID, Nama, Jual, Modal, Untung, Persen, Terjual, Stok, Berat -AutoSize |
  Out-String -Width 400
