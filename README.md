# HCX 9.1.1 — Service Mesh 殘留 / IX 遺失修復(Manager 升級後)

VCF Operations HCX 9.1.1 的根因分析、Lab 重現與現場修復程序。

## 兩個問題

**問題 A — ThumbprintExchanger 憑證主機名驗證失敗**
HCX Manager 升到 9.1.1 後,每 15 分鐘噴
`Host name '<IX IP>' does not match the certificate subject provided by the peer (CN=VMware vSphere Replication Server)`。
9.1.1 Manager 以 HttpClient5 嚴格驗證 IX HBR(port 8123)憑證的主機名;舊版 IX 的憑證沒有 IP SAN,所以必炸。
9.1.1(EDGE)appliance 的憑證帶 IP SAN、且 Manager 會把 appliance 憑證存進信任清單,所以不受影響。
旁路(已驗證):`SslHostnameVerifier` 只要對端 leaf 憑證在 9443 的 Trusted Certificates 裡,就跳過主機名驗證。

**問題 B — mesh 殘留、`lastTaskDetails` 不回寫**
IX VM 不見、`resyncServiceMesh` 中途消失,mesh 的 `lastTaskDetails` 永遠 RUNNING → UI「Loading service mesh list…」卡死。
修法(lab 閉環驗證):在**發起站**打 `DELETE /hybridity/api/interconnect/serviceMesh/{id}?force=true`,
之後重建 mesh(9.1.1 一律產生 EDGE appliance)。

## 內容
| 路徑 | 說明 |
|---|---|
| `HCX911-StaleMesh-Recovery-Report.docx` | 內部技術報告(10 頁) |
| `docs/analysis-and-lab-log.md` | 完整工作紀錄:log 片段、反編譯呼叫鏈、API 配方、lab 時間軸 |
| `docs/lab-hcx-deploy.md` | HCX Unified Appliance lab 部署紀錄 |
| `scripts/hcx_force_delete_mesh.py` | **現場用** — 以 `admin` SSH 進 HCX Manager 直接跑(python3 + requests 內建) |
| `scripts/Remove-StaleServiceMesh.ps1` | 同功能 PowerShell 版(跳板機) |
| `scripts/hcx-mesh-after-nsx.sh` | lab:註冊 NSX → site pairing → 建 mesh |
| `scripts/deploy-hcx0*.sh` | lab:ovftool 部署 appliance |
| `docs/gen-hcx911-stale-mesh-doc.js` | docx 產生器(docx-js) |

## 現場快速路徑
```bash
# 在「發起該 mesh」的 HCX Manager 上,以 admin 執行
python3 hcx_force_delete_mesh.py --user 'svc_hcx@DOMAIN'                                      # 只列出
python3 hcx_force_delete_mesh.py --user 'svc_hcx@DOMAIN' --delete --mesh-id servicemesh-xxxx    # 強制刪除
```
`default-service-mesh-*`(HCX Assisted vMotion 的系統 self-site mesh)**不可刪**,腳本會擋。

刪完確認:兩邊 Manager 的 appliances 為 0、compute profile 仍 VALID、兩邊 vCenter 沒有殘留的 Mobility Agent host;再重建 mesh。
若 force-delete 回「operation in progress」,先在 9443 重啟 APPENGINE 再試。

> lab 腳本中的密碼已改為 placeholder。
