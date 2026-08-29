Add-Type -AssemblyName System.Drawing

$src = "C:\Users\patel\.gemini\antigravity-ide\brain\be3bf1ac-69ed-4572-b3b4-adf13340c810\.user_uploaded\media_1788046842326.png"
$baseImg = [System.Drawing.Bitmap]::FromFile($src)

Write-Host "Original Image Size: $($baseImg.Width) x $($baseImg.Height)"

# Find bounding box of the red shield (Red > 150 and Red > Green*1.4 and Red > Blue*1.4)
$minX = $baseImg.Width
$maxX = 0
$minY = $baseImg.Height
$maxY = 0

for ($x = 0; $x -lt $baseImg.Width; $x += 2) {
    for ($y = 0; $y -lt $baseImg.Height; $y += 2) {
        $c = $baseImg.GetPixel($x, $y)
        if ($c.R -gt 150 -and ($c.R -gt ($c.G * 1.4)) -and ($c.R -gt ($c.B * 1.4))) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$minX = [Math]::Max(0, $minX - 4)
$minY = [Math]::Max(0, $minY - 4)
$maxX = [Math]::Min($baseImg.Width - 1, $maxX + 4)
$maxY = [Math]::Min($baseImg.Height - 1, $maxY + 4)

$shieldW = $maxX - $minX
$shieldH = $maxY - $minY
Write-Host "Shield Bounding Box: X=[$minX, $maxX], Y=[$minY, $maxY] ($shieldW x $shieldH)"

# Crop shield
$shieldRect = New-Object System.Drawing.Rectangle($minX, $minY, $shieldW, $shieldH)
$shieldBmp = New-Object System.Drawing.Bitmap($shieldW, $shieldH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($shieldBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.DrawImage($baseImg, (New-Object System.Drawing.Rectangle(0, 0, $shieldW, $shieldH)), $shieldRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

# Create icons with exact safe zone proportions
function Generate-Adaptive-Icon([int]$targetSize, [string]$outputPath, [string]$bgMode, [double]$scaleRatio) {
    $iconBmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gIcon = [System.Drawing.Graphics]::FromImage($iconBmp)
    $gIcon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gIcon.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gIcon.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($bgMode -eq "dark_square") {
        $gIcon.Clear([System.Drawing.Color]::FromArgb(255, 15, 23, 42)) # #0F172A
    } elseif ($bgMode -eq "dark_round") {
        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $targetSize, $targetSize)
        $gIcon.SetClip($path)
        $gIcon.FillPath($bgBrush, $path)
        $path.Dispose()
        $bgBrush.Dispose()
    } else {
        $gIcon.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0)) # Transparent
    }

    # Proportional scaling constrained by height & width
    $drawH = [int]($targetSize * $scaleRatio)
    $drawW = [int]($drawH * ($shieldW / $shieldH))
    
    # Ensure drawW does not exceed safe bounds
    if ($drawW -gt [int]($targetSize * $scaleRatio)) {
        $drawW = [int]($targetSize * $scaleRatio)
        $drawH = [int]($drawW * ($shieldH / $shieldW))
    }

    $drawX = [int](($targetSize - $drawW) / 2)
    $drawY = [int](($targetSize - $drawH) / 2)

    $gIcon.DrawImage($shieldBmp, $drawX, $drawY, $drawW, $drawH)
    $gIcon.Dispose()

    $dir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $iconBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Dispose()
    Write-Host "Generated: $outputPath (draw size: $drawW x $drawH inside $targetSize x $targetSize)"
}

# 1. App Assets (54% height for adaptive safe zone, 62% for standalone icon)
Generate-Adaptive-Icon 1024 "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\assets\images\icon.png" "dark_square" 0.62
Generate-Adaptive-Icon 1024 "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\assets\images\adaptive-icon.png" "transparent_fg" 0.54
Generate-Adaptive-Icon 1024 "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\assets\images\splash-icon.png" "dark_square" 0.54
Generate-Adaptive-Icon 1024 "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\assets\images\logo.png" "dark_square" 0.62

# 2. Mipmaps (foreground safe zone: 0.54, standalone legacy: 0.62)
$mipmaps = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $mipmaps.Keys) {
    $sz = $mipmaps[$folder]
    Generate-Adaptive-Icon $sz "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src\main\res\$folder\ic_launcher.png" "dark_square" 0.62
    Generate-Adaptive-Icon $sz "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src\main\res\$folder\ic_launcher_round.png" "dark_round" 0.62
    Generate-Adaptive-Icon $sz "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src\main\res\$folder\ic_launcher_foreground.png" "transparent_fg" 0.54

    Generate-Adaptive-Icon $sz "C:\SafeGuard-SOS\android\app\src\main\res\$folder\ic_launcher.png" "dark_square" 0.62
    Generate-Adaptive-Icon $sz "C:\SafeGuard-SOS\android\app\src\main\res\$folder\ic_launcher_round.png" "dark_round" 0.62
    Generate-Adaptive-Icon $sz "C:\SafeGuard-SOS\android\app\src\main\res\$folder\ic_launcher_foreground.png" "transparent_fg" 0.54
}

# 3. Android 12+ Splash Drawables
$drawables = @{
    "drawable-mdpi" = 120
    "drawable-hdpi" = 160
    "drawable-xhdpi" = 240
    "drawable-xxhdpi" = 320
    "drawable-xxxhdpi" = 480
}

foreach ($folder in $drawables.Keys) {
    $sz = $drawables[$folder]
    Generate-Adaptive-Icon $sz "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src\main\res\$folder\splashscreen_logo.png" "transparent_fg" 0.50
    Generate-Adaptive-Icon $sz "C:\SafeGuard-SOS\android\app\src\main\res\$folder\splashscreen_logo.png" "transparent_fg" 0.50
}

# 4. Widget Drawables (centered with 75% scale for prominent widget display)
Generate-Adaptive-Icon 256 "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src\main\res\drawable\widget_logo.png" "transparent_fg" 0.75
Generate-Adaptive-Icon 256 "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src\main\res\drawable-xxhdpi\widget_logo.png" "transparent_fg" 0.75
Generate-Adaptive-Icon 256 "C:\SafeGuard-SOS\android\app\src\main\res\drawable\widget_logo.png" "transparent_fg" 0.75
Generate-Adaptive-Icon 256 "C:\SafeGuard-SOS\android\app\src\main\res\drawable-xxhdpi\widget_logo.png" "transparent_fg" 0.75

$baseImg.Dispose()
$shieldBmp.Dispose()
Write-Host "Icons and widget sized and organized with perfect padding and safe zones!"
