param(
  [string]$OutputPath = "TippyMe-Investor-Deck.pptx",
  [string]$PdfPath = "TippyMe-Investor-Deck.pdf",
  [string]$PreviewDir = "deck-preview"
)

$ErrorActionPreference = "Stop"

function Inches([double]$value) { return $value * 72 }
function Rgb([int]$r, [int]$g, [int]$b) { return $r + ($g * 256) + ($b * 65536) }

$C = @{
  Ink       = Rgb 31 24 48
  Muted     = Rgb 104 94 122
  Purple    = Rgb 105 55 190
  Purple2   = Rgb 139 92 246
  Lavender  = Rgb 238 229 255
  Lavender2 = Rgb 248 245 255
  White     = Rgb 255 255 255
  Green     = Rgb 31 164 99
  Gold      = Rgb 241 176 74
  Line      = Rgb 224 215 239
  Dark      = Rgb 44 25 78
}

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "public\illustrations"
$hero = Join-Path $assets "hero.png"
$problem = Join-Path $assets "problem-bank.png"
$oneLink = Join-Path $assets "feature-one-link.png"
$makers = Join-Path $assets "feature-makers.png"

$output = Join-Path $root $OutputPath
$pdf = Join-Path $root $PdfPath
$preview = Join-Path $root $PreviewDir

function Add-Shape($slide, [int]$type, [double]$x, [double]$y, [double]$w, [double]$h, [int]$fill, [int]$line = -1, [double]$radius = 0) {
  $shape = $slide.Shapes.AddShape($type, (Inches $x), (Inches $y), (Inches $w), (Inches $h))
  $shape.Fill.Visible = -1
  $shape.Fill.Solid()
  $shape.Fill.ForeColor.RGB = $fill
  if ($line -lt 0) {
    $shape.Line.Visible = 0
  } else {
    $shape.Line.Visible = -1
    $shape.Line.ForeColor.RGB = $line
    $shape.Line.Weight = 1
  }
  return $shape
}

function Add-Text($slide, [string]$text, [double]$x, [double]$y, [double]$w, [double]$h, [double]$size, [int]$color, [bool]$bold = $false, [string]$font = "Aptos", [int]$align = 1) {
  $box = $slide.Shapes.AddTextbox(1, (Inches $x), (Inches $y), (Inches $w), (Inches $h))
  $box.Line.Visible = 0
  $box.Fill.Visible = 0
  $box.TextFrame.MarginLeft = 0
  $box.TextFrame.MarginRight = 0
  $box.TextFrame.MarginTop = 0
  $box.TextFrame.MarginBottom = 0
  $box.TextFrame.WordWrap = -1
  $range = $box.TextFrame.TextRange
  $range.Text = $text
  $range.Font.Name = $font
  $range.Font.Size = $size
  $range.Font.Bold = $(if ($bold) { -1 } else { 0 })
  $range.Font.Color.RGB = $color
  $range.ParagraphFormat.Alignment = $align
  return $box
}

function Add-PictureFit($slide, [string]$path, [double]$x, [double]$y, [double]$w, [double]$h) {
  $pic = $slide.Shapes.AddPicture($path, 0, -1, 0, 0, -1, -1)
  $targetW = Inches $w
  $targetH = Inches $h
  $scale = [Math]::Min($targetW / $pic.Width, $targetH / $pic.Height)
  $pic.Width = $pic.Width * $scale
  $pic.Height = $pic.Height * $scale
  $pic.Left = (Inches $x) + (($targetW - $pic.Width) / 2)
  $pic.Top = (Inches $y) + (($targetH - $pic.Height) / 2)
  return $pic
}

function Add-Brand($slide, [int]$index, [bool]$light = $false) {
  $wordColor = $(if ($light) { $C.White } else { $C.Ink })
  [void](Add-Shape $slide 9 0.52 0.38 0.20 0.20 $C.Purple)
  [void](Add-Text $slide "TippyMe" 0.82 0.30 1.8 0.35 17 $wordColor $true "Aptos Display")
  [void](Add-Text $slide ("0" + $index) 12.28 0.36 0.48 0.25 9 $(if ($light) { $C.Lavender } else { $C.Muted }) $true "Aptos" 3)
}

function Add-Notes($slide, [string]$notes) {
  try {
    foreach ($shape in $slide.NotesPage.Shapes) {
      if ($shape.Type -eq 14 -and $shape.PlaceholderFormat.Type -eq 2) {
        $shape.TextFrame.TextRange.Text = $notes
        return
      }
    }
  } catch {
    # Notes are helpful but should not block deck creation on unusual Office builds.
  }
}

function Add-Pill($slide, [string]$text, [double]$x, [double]$y, [double]$w, [int]$fill, [int]$textColor) {
  [void](Add-Shape $slide 5 $x $y $w 0.40 $fill)
  [void](Add-Text $slide $text ($x + 0.14) ($y + 0.10) ($w - 0.28) 0.20 9 $textColor $true "Aptos" 2)
}

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = -1
$presentation = $ppt.Presentations.Add()
$presentation.PageSetup.SlideSize = 15
$presentation.PageSetup.SlideWidth = Inches 13.333333
$presentation.PageSetup.SlideHeight = Inches 7.5

try {
  # Slide 1: Cover
  $s = $presentation.Slides.Add(1, 12)
  $bg = $s.Background.Fill
  $bg.Solid(); $bg.ForeColor.RGB = $C.Lavender2
  Add-Brand $s 1
  [void](Add-Shape $s 9 7.02 -0.72 6.95 6.95 $C.Lavender)
  [void](Add-Shape $s 9 10.82 5.35 2.90 2.90 $C.Purple2)
  [void](Add-PictureFit $s $hero 7.05 0.55 5.90 5.80)
  Add-Pill $s "LIVE PRODUCT  |  SOLO FOUNDER" 0.62 1.27 2.95 $C.Lavender $C.Purple
  [void](Add-Text $s "Support shouldn't require`na bank account in a DM." 0.62 1.91 6.28 1.72 30 $C.Ink $true "Aptos Display")
  [void](Add-Text $s "One link for everyone who wants to support your work." 0.64 4.02 5.62 0.70 17 $C.Muted $false "Aptos")
  $url = Add-Text $s "tippyme.click  ->" 0.64 5.30 2.36 0.42 14 $C.Purple $true "Aptos"
  $url.TextFrame.TextRange.ActionSettings(1).Hyperlink.Address = "https://www.tippyme.click/"
  [void](Add-Text $s "Investor conversation  |  2026" 0.64 6.76 3.60 0.24 9 $C.Muted $false "Aptos")
  Add-Notes $s "TippyMe gives creators one personal link where their community can support their work. The product is live and was built by one founder. This is not a concept deck; it is an invitation to help turn a working product into a focused, repeatable business."

  # Slide 2: Problem
  $s = $presentation.Slides.Add(2, 12)
  $s.Background.Fill.Solid(); $s.Background.Fill.ForeColor.RGB = $C.White
  Add-Brand $s 2
  Add-Pill $s "THE PROBLEM" 0.62 0.91 1.35 $C.Lavender $C.Purple
  [void](Add-Text $s "The desire to support exists.`nThe experience gets in the way." 0.62 1.48 6.18 1.20 25 $C.Ink $true "Aptos Display")
  $items = @(
    @{N="01"; T="Bank details in chats"; D="Account numbers get copied into DMs and group chats."},
    @{N="02"; T="Scattered payment tools"; D="Support becomes a multi-step task instead of a simple thank you."},
    @{N="03"; T="A narrow creator lens"; D="Builders, writers and community makers are often left out."}
  )
  $yy = 2.96
  foreach ($item in $items) {
    [void](Add-Text $s $item.N 0.66 $yy 0.42 0.34 10 $C.Purple $true "Aptos")
    [void](Add-Text $s $item.T 1.22 ($yy - 0.03) 2.72 0.36 15 $C.Ink $true "Aptos Display")
    [void](Add-Text $s $item.D 4.00 ($yy - 0.02) 2.55 0.50 11 $C.Muted $false "Aptos")
    [void](Add-Shape $s 1 0.64 ($yy + 0.57) 5.85 0.012 $C.Line)
    $yy += 1.03
  }
  [void](Add-Shape $s 5 7.13 1.12 5.58 5.84 $C.Lavender2 $C.Line)
  [void](Add-PictureFit $s $problem 7.35 1.45 5.14 4.85)
  [void](Add-Text $s "Friction sits between gratitude and payment." 7.58 6.23 4.70 0.34 13 $C.Dark $true "Aptos Display" 2)
  [void](Add-Shape $s 9 0.52 0.38 0.20 0.20 $C.Purple)
  [void](Add-Text $s "TippyMe" 0.82 0.30 1.8 0.35 17 $C.Ink $true "Aptos Display")
  Add-Notes $s "People already want to support developers, writers, artists and community builders. The problem is the experience: bank details in chats, multiple tools and a creator economy that often assumes everyone is an influencer. TippyMe removes the friction between gratitude and payment."

  # Slide 3: Solution
  $s = $presentation.Slides.Add(3, 12)
  $s.Background.Fill.Solid(); $s.Background.Fill.ForeColor.RGB = $C.Lavender2
  Add-Brand $s 3
  Add-Pill $s "THE SOLUTION" 0.62 0.91 1.42 $C.Lavender $C.Purple
  [void](Add-Text $s "One link. Three simple moments." 0.62 1.48 6.20 0.62 27 $C.Ink $true "Aptos Display")
  [void](Add-Text $s "TippyMe turns support into a clear, human journey." 0.64 2.16 5.65 0.46 14 $C.Muted $false "Aptos")
  $steps = @(
    @{N="1"; T="Create"; D="Claim a personal page in minutes."},
    @{N="2"; T="Share"; D="Use one link across social, newsletters and websites."},
    @{N="3"; T="Receive"; D="Supporters pay and leave a message - no account needed."}
  )
  $yy = 2.92
  foreach ($step in $steps) {
    [void](Add-Shape $s 9 0.66 $yy 0.58 0.58 $C.Purple)
    [void](Add-Text $s $step.N 0.66 ($yy + 0.12) 0.58 0.24 12 $C.White $true "Aptos" 2)
    [void](Add-Text $s $step.T 1.48 ($yy - 0.02) 1.34 0.34 16 $C.Ink $true "Aptos Display")
    [void](Add-Text $s $step.D 2.78 $yy 3.35 0.52 11 $C.Muted $false "Aptos")
    $yy += 1.10
  }
  [void](Add-Shape $s 5 6.78 1.18 5.92 5.80 $C.White $C.Line)
  [void](Add-PictureFit $s $oneLink 7.02 1.38 5.44 4.82)
  Add-Pill $s "MESSAGES  |  GOALS  |  INSIGHTS  |  PAYOUTS" 7.37 6.27 4.72 $C.Dark $C.White
  Add-Notes $s "The flow is deliberately simple. A creator creates a page and shares one link. A supporter chooses an amount, optionally leaves a personal or anonymous message, and pays without opening a TippyMe account. The creator sees support, goals, insights and payout information in one dashboard."

  # Slide 4: Differentiation
  $s = $presentation.Slides.Add(4, 12)
  $s.Background.Fill.Solid(); $s.Background.Fill.ForeColor.RGB = $C.Dark
  [void](Add-Shape $s 1 0 0 13.333333 7.5 $C.Dark)
  Add-Brand $s 4 $true
  Add-Pill $s "WHY TIPPYME" 0.62 0.91 1.49 $C.Purple $C.White
  [void](Add-Text $s "More personal than a payment link." 0.62 1.49 6.25 0.68 27 $C.White $true "Aptos Display")
  [void](Add-Text $s "A creator-support experience, not another wallet." 0.64 2.18 5.74 0.44 14 $C.Lavender $false "Aptos")
  $cards = @(
    @{X=0.64; Y=2.96; T="One reusable link"; D="No bank details pasted into chats."},
    @{X=3.57; Y=2.96; T="No supporter sign-up"; D="Less friction between intent and action."},
    @{X=0.64; Y=4.58; T="Support feels human"; D="Messages and anonymity preserve the personal moment."},
    @{X=3.57; Y=4.58; T="Built for African makers"; D="Developers, writers, artists and community builders."}
  )
  foreach ($card in $cards) {
    $box = Add-Shape $s 5 $card.X $card.Y 2.64 1.28 $C.White
    $box.Fill.Transparency = 0.91
    $box.Line.Visible = -1; $box.Line.ForeColor.RGB = $C.Purple2; $box.Line.Transparency = 0.58
    [void](Add-Shape $s 9 ($card.X + 0.18) ($card.Y + 0.19) 0.22 0.22 $C.Purple2)
    [void](Add-Text $s $card.T ($card.X + 0.52) ($card.Y + 0.15) 1.92 0.36 13 $C.White $true "Aptos Display")
    [void](Add-Text $s $card.D ($card.X + 0.20) ($card.Y + 0.62) 2.22 0.46 10 $C.Lavender $false "Aptos")
  }
  [void](Add-Shape $s 5 6.77 1.15 5.93 5.84 $C.White)
  [void](Add-PictureFit $s $makers 7.08 1.42 5.30 4.72)
  [void](Add-Text $s "TippyMe owns the creator experience.`nBachs moves the money." 7.32 6.07 4.80 0.64 14 $C.Dark $true "Aptos Display" 2)
  Add-Notes $s "TippyMe is not trying to become a bank or payment processor. It owns the creator page and supporter relationship, while Bachs handles the movement of money. That lets the product focus on what makes support easy, personal and useful for African makers."

  # Slide 5: Customer + business model
  $s = $presentation.Slides.Add(5, 12)
  $s.Background.Fill.Solid(); $s.Background.Fill.ForeColor.RGB = $C.White
  Add-Brand $s 5
  Add-Pill $s "CUSTOMER + MODEL" 0.62 0.91 1.78 $C.Lavender $C.Purple
  [void](Add-Text $s "A focused customer. A simple model." 0.62 1.48 6.80 0.68 27 $C.Ink $true "Aptos Display")
  [void](Add-Text $s "Start with people whose work already creates value for an online community." 0.64 2.18 6.26 0.48 13 $C.Muted $false "Aptos")
  [void](Add-Text $s "WHO" 0.66 2.99 0.62 0.26 9 $C.Purple $true "Aptos")
  [void](Add-Text $s "African independent creators`nand digital builders" 0.66 3.34 4.55 0.86 21 $C.Ink $true "Aptos Display")
  $pills = @(
    @{T="Developers"; X=0.66; Y=4.56; W=1.34}, @{T="Writers"; X=2.14; Y=4.56; W=1.06}, @{T="Designers"; X=3.34; Y=4.56; W=1.25},
    @{T="Artists"; X=0.66; Y=5.12; W=0.96}, @{T="Researchers"; X=1.76; Y=5.12; W=1.34}, @{T="Podcasters"; X=3.24; Y=5.12; W=1.31},
    @{T="Open source"; X=0.66; Y=5.68; W=1.40}, @{T="Community builders"; X=2.20; Y=5.68; W=2.06}
  )
  foreach ($pill in $pills) { Add-Pill $s $pill.T $pill.X $pill.Y $pill.W $C.Lavender2 $C.Purple }
  [void](Add-Shape $s 5 7.12 1.36 5.56 5.62 $C.Lavender2 $C.Line)
  [void](Add-Text $s "CURRENT BUSINESS MODEL" 7.56 1.82 2.90 0.28 9 $C.Purple $true "Aptos")
  [void](Add-Text $s "5%" 7.53 2.22 2.55 1.08 47 $C.Purple $true "Aptos Display")
  [void](Add-Text $s "default platform fee`nper successful tip" 9.50 2.43 2.48 0.72 14 $C.Ink $true "Aptos Display")
  [void](Add-Shape $s 1 7.54 3.52 4.70 0.012 $C.Line)
  $flow = @(
    @{T="Supporter pays"; D="Simple checkout"},
    @{T="Creator receives"; D="Support + message"},
    @{T="TippyMe earns"; D="Only when value moves"}
  )
  $yy = 3.88
  foreach ($row in $flow) {
    [void](Add-Shape $s 9 7.57 ($yy + 0.04) 0.28 0.28 $C.Purple)
    [void](Add-Text $s $row.T 8.02 $yy 1.86 0.30 13 $C.Ink $true "Aptos Display")
    [void](Add-Text $s $row.D 9.93 ($yy + 0.01) 2.13 0.28 10 $C.Muted $false "Aptos")
    $yy += 0.69
  }
  [void](Add-Text $s "Bachs handles payment processing and payouts." 7.56 6.36 4.70 0.28 10 $C.Muted $false "Aptos")
  Add-Notes $s "The initial focus is African independent creators and builders who already have an online community. Creators use TippyMe; supporters fund them. The current model is a configurable platform fee, defaulting to five percent of successful tips. TippyMe earns only when value moves through the platform."

  # Slide 6: Progress + invitation
  $s = $presentation.Slides.Add(6, 12)
  $s.Background.Fill.Solid(); $s.Background.Fill.ForeColor.RGB = $C.Lavender2
  Add-Brand $s 6
  Add-Pill $s "WHY BACK IT NOW" 0.62 0.91 1.72 $C.Lavender $C.Purple
  [void](Add-Text $s "A live product built by one founder." 0.62 1.48 7.00 0.68 28 $C.Ink $true "Aptos Display")
  [void](Add-Text $s "The next milestone is evidence: focused adoption, repeat support and a clear scaling plan." 0.64 2.18 7.16 0.46 13 $C.Muted $false "Aptos")
  $proof = @(
    @{X=0.64; K="LIVE"; V="tippyme.click"; D="A public product, not a prototype."},
    @{X=3.56; K="BUILT"; V="Onboarding -> payouts"; D="The core creator and supporter journey exists."},
    @{X=6.48; K="FOCUSED NEXT"; V="Pilot and learn"; D="Prove what drives support and repeat use."}
  )
  foreach ($p in $proof) {
    [void](Add-Shape $s 5 $p.X 3.00 2.62 1.54 $C.White $C.Line)
    [void](Add-Text $s $p.K ($p.X + 0.20) 3.22 1.55 0.22 9 $C.Purple $true "Aptos")
    [void](Add-Text $s $p.V ($p.X + 0.20) 3.57 2.20 0.36 15 $C.Ink $true "Aptos Display")
    [void](Add-Text $s $p.D ($p.X + 0.20) 4.02 2.16 0.38 10 $C.Muted $false "Aptos")
  }
  [void](Add-Shape $s 5 9.48 1.16 3.19 5.81 $C.Dark)
  [void](Add-Text $s "NEXT PHASE" 9.86 1.62 1.55 0.24 9 $C.Lavender $true "Aptos")
  $next = @("Recruit a focused first creator cohort", "Measure conversion and repeat support", "Strengthen reliability and payment operations", "Define the raise from validated milestones")
  $yy = 2.16
  foreach ($item in $next) {
    [void](Add-Shape $s 9 9.88 ($yy + 0.06) 0.20 0.20 $C.Purple2)
    [void](Add-Text $s $item 10.28 $yy 1.96 0.56 11 $C.White $true "Aptos")
    $yy += 0.84
  }
  [void](Add-Text $s "Back the next phase of creator support in Africa." 0.64 5.30 8.08 0.74 23 $C.Purple $true "Aptos Display")
  [void](Add-Text $s "Let's build the proof together." 0.66 6.22 4.66 0.42 14 $C.Ink $true "Aptos")
  [void](Add-Shape $s 9 0.52 0.38 0.20 0.20 $C.Purple)
  [void](Add-Text $s "TippyMe" 0.82 0.30 1.8 0.35 17 $C.Ink $true "Aptos Display")
  Add-Notes $s "One founder has already built and launched the core product. I am not presenting an arbitrary funding number today. I am looking for investors and strategic partners who can help recruit a focused first cohort, validate repeat behavior, strengthen operations and define the right raise from evidence. The invitation is simple: help turn a live product into a repeatable creator-support business."

  # Save editable PowerPoint and a shareable PDF.
  $presentation.SaveAs($output, 24)
  $presentation.SaveAs($pdf, 32)
  if (-not (Test-Path $preview)) { [void](New-Item -ItemType Directory -Path $preview) }
  foreach ($slide in $presentation.Slides) {
    $slide.Export((Join-Path $preview ("slide-{0}.png" -f $slide.SlideIndex)), "PNG", 1600, 900)
  }
}
finally {
  if ($presentation) { $presentation.Close() }
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

Write-Output $output
Write-Output $pdf
