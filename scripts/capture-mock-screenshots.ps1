param(
  [string]$Port = "3100"
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$ScreenshotDir = Join-Path $RootDir "docs\screenshots"
$TempDir = Join-Path $RootDir ".tmp"
$ServerStdout = Join-Path $TempDir "screenshots-next.stdout.log"
$ServerStderr = Join-Path $TempDir "screenshots-next.stderr.log"
$HostName = "127.0.0.1"
$BaseUrl = "http://${HostName}:${Port}"

$Pages = @(
  @{
    Name = "dashboard-overview.png"
    Path = "/?view=table"
    Description = "Dashboard em tabela com dados mockados."
  },
  @{
    Name = "kanban.png"
    Path = "/?view=kanban"
    Description = "Kanban usando os chamados mockados."
  },
  @{
    Name = "advanced-filters.png"
    Path = "/?panel=filters"
    Description = "Modal de filtros avancados com opcoes mockadas."
  }
)

function Wait-ForServer {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $startedAt = Get-Date

  while (((Get-Date) - $startedAt).TotalSeconds -lt $TimeoutSeconds) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }

  throw "Servidor nao respondeu em $Url dentro de ${TimeoutSeconds}s."
}

function Stop-ProcessTree {
  param([System.Diagnostics.Process]$Process)

  if ($null -eq $Process -or $Process.HasExited) {
    return
  }

  taskkill /pid $Process.Id /t /f | Out-Null
}

New-Item -ItemType Directory -Force -Path $ScreenshotDir | Out-Null
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
Remove-Item -Force $ServerStdout, $ServerStderr -ErrorAction SilentlyContinue

$previousForceMock = $env:SOFTDESK_FORCE_MOCK
$env:SOFTDESK_FORCE_MOCK = "true"

$server = $null

try {
  $server = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "--hostname", $HostName, "--port", $Port) `
    -WorkingDirectory $RootDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ServerStdout `
    -RedirectStandardError $ServerStderr `
    -PassThru

  try {
    Wait-ForServer -Url "$BaseUrl/"
  } catch {
    if (Test-Path $ServerStdout) {
      Write-Host "--- Next stdout ---"
      Get-Content $ServerStdout
    }

    if (Test-Path $ServerStderr) {
      Write-Host "--- Next stderr ---"
      Get-Content $ServerStderr
    }

    throw
  }

  foreach ($page in $Pages) {
    $outputPath = Join-Path $ScreenshotDir $page.Name
    $url = "$BaseUrl$($page.Path)"
    $safeName = $page.Name -replace "[^a-zA-Z0-9.-]", "-"
    $captureStdout = Join-Path $TempDir "screenshots-$safeName.stdout.log"
    $captureStderr = Join-Path $TempDir "screenshots-$safeName.stderr.log"
    Remove-Item -Force $captureStdout, $captureStderr -ErrorAction SilentlyContinue

    $arguments = @(
      "playwright",
      "screenshot",
      "--browser",
      "chromium",
      "--channel",
      "chrome",
      "--viewport-size",
      "1440,1100",
      "--wait-for-timeout",
      "3000",
      "--full-page",
      $url,
      $outputPath
    )

    $capture = Start-Process `
      -FilePath "npx.cmd" `
      -ArgumentList $arguments `
      -WorkingDirectory $RootDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $captureStdout `
      -RedirectStandardError $captureStderr `
      -Wait `
      -PassThru

    if ($capture.ExitCode -ne 0 -or -not (Test-Path $outputPath)) {
      if (Test-Path $captureStdout) {
        Write-Host "--- Playwright stdout ($($page.Name)) ---"
        Get-Content $captureStdout
      }

      if (Test-Path $captureStderr) {
        Write-Host "--- Playwright stderr ($($page.Name)) ---"
        Get-Content $captureStderr
      }

      throw "Falha ao capturar $url."
    }

    Write-Host "OK $($page.Name) - $($page.Description)"
  }
} finally {
  Stop-ProcessTree -Process $server

  if ($null -eq $previousForceMock) {
    Remove-Item Env:\SOFTDESK_FORCE_MOCK -ErrorAction SilentlyContinue
  } else {
    $env:SOFTDESK_FORCE_MOCK = $previousForceMock
  }
}
