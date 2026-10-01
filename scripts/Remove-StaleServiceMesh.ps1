<#
 玉山 HCX:IX VM 已不存在、Service Mesh "Update Appliances" 卡住 → 強制刪除殘留 mesh,讓後續升級/重建能走。
 在跳板機(172.17.1.248)PowerShell 執行。**必須在「發起 mesh 的那一站」執行** = 來源端 hcxt.esunbank.com.tw
 (mesh esbvcsa01-sddctestvcsa 的 isInitiator=true 在 hcxt;從目的端刪會被拒絕)。
 用法:
   .\Remove-StaleServiceMesh.ps1 -Hcx https://hcxt.esunbank.com.tw -User 'svc_hcx@ESB.LOCAL'            # 只列出,不刪
   .\Remove-StaleServiceMesh.ps1 -Hcx https://hcxt.esunbank.com.tw -User 'svc_hcx@ESB.LOCAL' -MeshId servicemesh-fb5509e1-b47b-4166-a130-491380284922 -Delete
#>
param([Parameter(Mandatory)][string]$Hcx,[Parameter(Mandatory)][string]$User,[string]$MeshId,[switch]$Delete)
$ErrorActionPreference='Stop'
if ($PSVersionTable.PSVersion.Major -lt 6) { add-type @"
using System.Net;using System.Security.Cryptography.X509Certificates;
public class TrustAll:ICertificatePolicy{public bool CheckValidationResult(ServicePoint s,X509Certificate c,WebRequest r,int p){return true;}}
"@; [System.Net.ServicePointManager]::CertificatePolicy=New-Object TrustAll; [Net.ServicePointManager]::SecurityProtocol='Tls12' }
$skip = @{}; if ($PSVersionTable.PSVersion.Major -ge 6) { $skip = @{SkipCertificateCheck=$true} }
$pw = Read-Host -AsSecureString "Password for $User"; $pwPlain=[Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
$r = Invoke-WebRequest @skip -Method Post -Uri "$Hcx/hybridity/api/sessions" -ContentType 'application/json' -Body (@{username=$User;password=$pwPlain}|ConvertTo-Json) -UseBasicParsing
$tok = $r.Headers['x-hm-authorization']; if (-not $tok) { throw 'login failed' }; $h=@{'x-hm-authorization'=$tok;'Accept'='application/json'}
Write-Host "`n=== Service meshes on $Hcx ===" -ForegroundColor Cyan
$m = Invoke-RestMethod @skip -Uri "$Hcx/hybridity/api/interconnect/serviceMesh" -Headers $h
$m.items | ForEach-Object { '{0,-52} {1,-32} state={2} lastTask={3}/{4} backing={5}' -f $_.serviceMeshId,$_.name,$_.state,$_.lastTaskDetails.type,$_.lastTaskDetails.status,$_.backingApplianceType }
Write-Host "`n=== Appliances ===" -ForegroundColor Cyan
$a = Invoke-RestMethod @skip -Uri "$Hcx/hybridity/api/interconnect/appliances" -Headers $h
$a.items | ForEach-Object { '{0,-40} {1,-36} {2,-12} mesh={3} status={4}' -f $_.applianceId,$_.applianceName,$_.applianceType,$_.serviceMeshId,$_.status.summary.overallStatus }
if (-not $Delete) { Write-Host "`n(只列出。要刪請加 -MeshId <id> -Delete)" -ForegroundColor Yellow; return }
if (-not $MeshId) { throw '-Delete 需要 -MeshId' }
if ($MeshId -like 'servicemesh-379b96be*' -or ($m.items | ? serviceMeshId -eq $MeshId).name -like 'default-service-mesh*') { throw '這是系統自動建的 self-site mesh(HCX Assisted vMotion),不要刪' }
Write-Host "`n!!! 即將 FORCE DELETE $MeshId on $Hcx" -ForegroundColor Red; if ((Read-Host 'type YES') -ne 'YES') { return }
$d = Invoke-RestMethod @skip -Method Delete -Uri "$Hcx/hybridity/api/interconnect/serviceMesh/$MeshId`?force=true" -Headers $h
$d | ConvertTo-Json -Depth 5; $tid=$d.data.interconnectTaskId
if ($tid) { for ($i=0;$i -lt 120;$i++){ Start-Sleep 10; $t=Invoke-RestMethod @skip -Uri "$Hcx/hybridity/api/interconnect/tasks/$tid" -Headers $h; Write-Host ("{0} {1}% {2}" -f $t.status,$t.progress,$t.message); if ($t.status -notin 'RUNNING','QUEUED'){break} } }
Write-Host "`n=== after ===" -ForegroundColor Cyan
(Invoke-RestMethod @skip -Uri "$Hcx/hybridity/api/interconnect/serviceMesh" -Headers $h).items | % { '{0} {1} {2}' -f $_.serviceMeshId,$_.name,$_.state }
