# 玉山 HCX 9.1.1 升級後狀態除錯 — 工作狀態(2026-09-30)

來源:`C:\Users\Administrator\OneDrive\桌面\玉山\20260930.zip`
(5 個 HCX Manager support bundle + `sddc-hcxt.esunbank.com.tw.har`),解在 scratchpad `esun/20260930/x/<id>/`。

## 客戶拓樸(從 bundle 讀出)

| id | hostname | 角色 | 升 9.1.1 時間(UTC) |
|---|---|---|---|
| 06358e | mgt-hcx.esunbank.com.tw | 管理域 HCX | 2026-09-24 07:58 |
| 4187a0 | sddc-hcx.esunbank.com.tw | SDDC HCX | 2026-09-24 07:29 |
| ccf0bd | prd-hcx.esunbank.com.tw | 正式 HCX | 2026-09-24 07:58 |
| 0fee91 | hcxt.esunbank.com.tw | **測試來源**(vC esbvcsa01 8.0.3) | 2026-09-29 06:55 |
| 6f5de1 | sddc-hcxt.esunbank.com.tw(172.17.72.141) | **測試目標**(VCF 9.1:vC sddc-testvcsa 9.1.0.0300 + NSX 9.1.0) | 2026-09-29 06:29 |

HAR = 目標端 sddc-hcxt 的 Service Mesh 頁。兩個 mesh:
- `esbvcsa01-sddctestvcsa`(INTERCONNECT,IX-R1 = c9954711…,tunnels 8/8 up)— **`updateAvailable: true`**,lastTask `resyncServiceMesh` 6bbdfde8 顯示 RUNNING(09-08 起的)。
- `default-service-mesh-379b96be`(auto self-site,HCX_ASSISTED_VMOTION)— lastTask `autoSelfSiteServiceMeshCreate` 0344e183 顯示 RUNNING,**但 job log 07-13 08:25:40 已 `State:COMPLETE`** → 任務狀態沒回寫,是殘留顯示。

## 🔴 主要發現:5 座 manager 升 9.1.1 後全部對 IX 的 HBR 憑證主機名驗證失敗

`ThumbprintExchanger` 每 ~15 分鐘一次:
```
Error adding lwd proxy as trusted site to connection broker in appliance c9954711…
  java.lang.RuntimeException: Error Running request  (HbrServerInstance.login → loginBySSLCertificate)
Caused by: PeerNotVerifiedException: Host name '172.17.72.142' does not match the certificate subject
  provided by the peer (CN=VMware vSphere Replication Server, OU=VMware vSphere Replication Server Certificate, O="VMware, Inc" …)
  at org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory.verifyHostname
```
起始時間 = 各 manager 升級當天;升級前一筆都沒有。命中數 / 對端 IP:

| manager | hits | 失敗對端(IX HBR) |
|---|---|---|
| mgt-hcx | 2188 | 172.17.79.134 |
| sddc-hcx | 4376 | 172.17.79.131, .132 |
| prd-hcx | 2188 | 172.17.72.145 |
| hcxt(來源) | 300 | 172.17.72.139 |
| sddc-hcxt(目標) | 308 | 172.17.72.142 |

判讀:9.1.1 的 Manager 用 Apache HttpClient5 對 IX 上的 HBR(vSphere Replication server)做**嚴格 hostname 驗證**,
而 IX 的 HBR 憑證是通用自簽(CN=VMware vSphere Replication Server,無 IP SAN)→ 一律不符 → Manager 登不進 IX 的
connection broker → thumbprint 交換失敗。IX appliance 仍是 9.1.0.0100(mesh 顯示 update available)。

其他錯誤(次要):`NsxTInventorySyncJob` 同步 traffic group 回 500(目標端 NSX 9.1.0);Phonehome 上傳 timeout(air-gap,可忽略)。

## Lab 重現/驗證計畫

lab 只有 **9.1.1 OVA**(`hcx-unified-appliance-9.1.1.0.25690219.ova`,跟客戶同 build)。
- hcx01 10.0.0.86(接外層 vC 10.0.0.101)✅ 已部好
- vcf-m02-hcx 10.0.1.26(要接 M02 vC 10.0.1.19,**等 M02 那個 session 做完 cluster/converge 再註冊**)✅ 已部好,9443 auth OK
- 可驗證的問題:**9.1.1 Manager + 9.1.1 IX 是否仍出現同樣 hostname 驗證錯誤?**
  - 若仍出現 → 9.1.1 本身的 bug(與 appliance 版本無關),需要 KB / hotfix
  - 若不出現 → 解法 = 把 service mesh 的 appliance 更新到 9.1.1
- 精確重現(舊 IX + 新 Manager)需要 9.1.0.0100 OVA,目前沒有。

## 待確認(問使用者)
- 客戶端實際症狀是什麼(遷移失敗?mesh 更新失敗?UI 卡 RUNNING?)
- 有沒有 9.1.0.0100 的 OVA / 或要不要走 depot 抓

## Lab 進度 2026-09-30(B 路線:9.1.1 + 9.1.1)

### hcx01 → 外層 vC 註冊(9443 appliance-mgmt API 實測配方)
- 先 POST `/api/admin/global/config/vcenter` 會回 `Untrusted SSL connection` + 憑證 → 拿 `data[0].certificate`
  POST `/api/admin/certificates` `{"certificate":"<base64>"}` 匯入信任。
- 🔴 **config API 的 password 一律 base64**(UI 用 `btoa`)。給明文會得到 vCenter 的
  `expat parser: reference to invalid character number ... method Login` 假訊息(HCX 把明文當 base64 解成亂碼)。
- body 格式:`{"data":{"items":[{"config":{...},"section":"<section>"}]}}`;section = vcenter / lookupservice / nsx / location / roleMappings / telemetry。
- vCenter URL 用 **labvc.lab.com**(憑證 CN),不用 IP。lookupservice = `https://labvc.lab.com/lookupservice/sdk` → providerType PSC。
- 9.1.1 不需啟用碼:`/api/admin/licenses` 回 `EVALUATION_MODE`,grace 到 2026-12-28。
- 結果:vcenter 8.0.3.00000.24022515 註冊 OK(vcuuid 46072aa4…)。

### 兩站註冊完成(2026-09-30)
| | hcx01(來源) | vcf-m02-hcx(目標) |
|---|---|---|
| Manager | 10.0.0.86 | 10.0.1.26 |
| vCenter | labvc.lab.com 8.0.3.00000.24022515,vcuuid 46072aa4-9d3f-474a-8f5d-42e5ff8785bc | vcf-m02-vc01.home.lab 9.1.1.0.25712839,vcuuid 7cd5913a-8048-4ede-b330-89b9fca99ffc |
| DC / Cluster | datacenter-21 / domain-c26(Cluster:95/97/98) | datacenter-3 / domain-c9(vcf-m02-cl01,DRS+HA on) |
| Datastore | datastore-17628 vmfs-samsung4t | datastore-15 vsanDatastore(3862 GB free) |
| Mgmt portgroup | dvportgroup-443 MGMT(dvs-421) | dvportgroup-23 SDDC-DPortGroup-VM-Mgmt(dvs-21,VLAN 0) |
| IX IP pool(規劃) | 10.0.0.87-93 /23 gw 10.0.0.1 | 10.0.1.27-35 /23 gw 10.0.0.1 |
| HCX endpointId | (見 metainfo) | 20260930095531162-de434b28-af6e-4d65-9026-b064bc6ac023 |
hcx02 註冊時 10.0.1.19 狀態:dc01/cl01 已建、converge 尚未送出(使用者同意先註冊)。

### API 配方(hybridity API,token = POST /hybridity/api/sessions 回的 x-hm-authorization)
- API 說明在 `https://<hcx>/hybridity/docs/`,spec 在 `/hybridity/docs/apis/<component>/<schema>`(swagger-ui 讀的路徑),存於 scratchpad `hcxapi/`。
- Network profile:`POST /admin/hybridity/api/networks`,必填 `l3TenantManaged:false`(spec 沒說必填但會 400),backing = `{backingId:"dvportgroup-N",type:"DistributedVirtualPortgroup",vCenterInstanceUuid}`。
  hcx01 `network-e797cf9a-9782-4229-8538-0771b4e371e5`(10.0.0.87-93)/ hcx02 `network-d2c47368-5771-4c3d-9384-b06c88213bf0`(10.0.1.27-35),皆 REALIZED。
- Compute profile:`POST /hybridity/api/interconnect/computeProfiles/preview` → `/computeProfiles`;compute/storage/switches 都要 `cmpId=vcuuid`+`type`+`id(moid)`;networks tags = management/uplink/vmotion/replication 全掛同一 profile。
  hcx01 `cp-outer` = fad929b6-1f16-4b4e-9c4d-84b3dc2f9ac0 / hcx02 `cp-m02` = 73e60e21-83ea-454b-bcd0-f0b7196eec5f,皆 VALID(services: INTERCONNECT/VMOTION/BULK_MIGRATION/NETWORK_EXTENSION)。

### 🔴 卡點(2026-09-30 19:5x):site pairing 需要目的端 HCX 已註冊 NSX-T
`POST /hybridity/api/cloudConfigs` body = `{"remote":{"url","username","password"}}`(flat body會 NPE remoteSystemInfo);
遠端憑證要先用 9443 `/api/admin/certificates` 匯入。之後回:
`Site pairing with HCX Manager is not permitted without registering a valid NSX-T Manager. Register the NSX-T Manager ... at the destination HCX Manager`
→ 目的端 vcf-m02-hcx 要有 NSX。M02 目前沒有 NSX(converge 未送)。
**跨 session 影響:M02 converge 必須選有 NSX 的變體 A**(變體 B 完全不部 NSX 會讓 HCX 目的端永遠配不了對)。

### 決定與下一步(2026-09-30 20:0x)
使用者決定**等 converge 變體 A 把 NSX 部出來**,不另部 NSX。
NSX 起來後執行 `E:\9.1\hcx-mesh-after-nsx.sh <nsx-url> admin '<pw>'`:註冊 NSX → pairing → mesh(INTERCONNECT)→ 盯 ThumbprintExchanger。
serviceMesh payload 是依 spec 推的,preview 若擋再依錯誤修(computeProfiles[].networks tags=uplink 是照客戶 mesh 的樣子)。

客戶 5 座 manager 的 IX 全都還是 9.1.0.x、沒有任何 appliance 升級動作(log 零筆)→ 客戶資料本身無法回答「IX 升 9.1.1 會不會好」,只能靠 lab。
客戶拓樸:mgt-hcx↔sddc-hcx(mgtvcsa-sddcmgtvcsa)、prd-hcx↔sddc-hcx(prdvcsa-sddcmgtvcsa)、hcxt↔sddc-hcxt(esbvcsa01-sddctestvcsa)。

## 🔑 程式碼層面的根因與可能修法(2026-09-30 20:3x,反編譯 lab hcx01 9.1.1 jar)

jar:`/opt/vmware/Services/interconnect-service_1.0/interconnect-service-1.0.jar`(ThumbprintExchanger)、
`/opt/vmware/Adapters/1.0/lib_unified_hbr_adapter-1.0.jar`(HbrServerInstance/HbrConnection)、
`/opt/vmware/Adapters/1.0/lib_https_adapter-1.0.jar`(HttpsAdapter/SslHostnameVerifier)。root 只能 `su -`(admin 不在 sudoers)。

呼叫鏈:`ThumbprintExchanger.getConnectionBrokerInstance` → serverType **HBRSRV_CONNECTION_BROKER** →
`UnifiedVrAdapterFactory.getHbrServerInstance(ip,"9.0.0.0",…,certAuth=true)` → `new HbrConnection(ip, …)`(預設 HBRSRV_NOW,port 8123)
→ `hostnameVerifier(Constants.DEFAULT_HOSTNAME_VERIFIER)`;**只有 HBRSRV_UW(新一代 ESX 內建 hbrsrv,443)才 `hostnameVerifierOff()`**。
→ 舊架構 IX(PHOTON,UI 也在提醒 legacy data-path 要淘汰)一律走嚴格驗證,而 HBR 憑證 CN=VMware vSphere Replication Server 無 IP SAN → 必炸。

**但 `SslHostnameVerifier.verify()` 有旁路**:
```java
sha256 = leaf cert 的 SHA-256; keystore = KeyManager.loadTrustedCertificates([sha256]);
isCertificateVerified = optCert.isPresent() || delegate.verify(host, session);   // ← 信任清單有這張憑證就不看 hostname
```
→ **候選修法(現場可做、不改碼)**:把每台 IX 的 HBR/connection-broker 憑證(https://<IX-mgmt-IP>:8123 呈現的那張)匯進該 Manager 的
Appliance Management(9443)→ Administration → Trusted Certificates。待 lab mesh 起來後驗證。
其他選項:把 mesh 換到 modern appliance architecture(HBRSRV_UW 路徑,關掉驗證)= 官方方向;或等 Broadcom hotfix。

### ✅ 旁路機制已在 lab 驗證(2026-09-30 20:4x)
- `KeyManager.loadTrustedCertificates(keystore,[sha256])` 查的是 Postgres `certstore` 集合、bucket **"trusted certificate"**,
  而 9443 → Administration → Trusted Certificates 匯入的就是這個 bucket(hcx01 log:`Saved trusted certificate, alias …, bucketName: trusted certificate`)。
- 實測:hcx01 先匯入 vcf-m02-hcx 的憑證(CN=vcf-m02-hcx.home.lab),再用 **IP** `https://10.0.1.26` 做 site pairing →
  直接通過 TLS 走到 NSX 檢查(不是 hostname 錯)→ 證明「憑證在信任清單 = 跳過 hostname 驗證」在同一條 HttpsAdapter/SslHostnameVerifier 路徑成立。
- 9443 Trusted Certificates 支援三種匯入:file / **url** / 貼上 PEM。

### 現場修法(候選,待 mesh 起來做最終驗證)
對**每一座** Manager,把它自己那些 IX 的 hbrsrv 憑證匯入信任清單:
| Manager | IX(HBR) | 匯入來源 |
|---|---|---|
| mgt-hcx | 172.17.79.134 | https://172.17.79.134:8123 |
| sddc-hcx | 172.17.79.131 / .132 | https://172.17.79.131:8123、https://172.17.79.132:8123 |
| prd-hcx | 172.17.72.145 | https://172.17.72.145:8123 |
| hcxt | 172.17.72.139 | https://172.17.72.139:8123 |
| sddc-hcxt | 172.17.72.142 | https://172.17.72.142:8123 |
步驟:9443 → Administration → Trusted Certificates → Import → URL(填 `https://<IX IP>:8123`);若 URL 匯入不吃 port,
就在 Manager 上 `openssl s_client -connect <IX IP>:8123 -showcerts </dev/null` 取 leaf PEM(CN=VMware vSphere Replication Server)用「貼上」匯入。
驗證:等下一輪 PeriodicThumbprintExchanger(≤15 分)或在 mesh 按 Resync/Force Sync;`/common/logs/admin/app.log` 不再出現
`Error adding lwd proxy … does not match the certificate subject`。
正規路線:mesh 更新 appliance 到 9.1.1(仍是 legacy PHOTON 路徑,9443 沒關驗證,**預期不會解**)→ 遷到 modern appliance architecture(HBRSRV_UW,程式碼裡 hostnameVerifierOff)。

### UI「Loading service mesh list…」
截圖(sddc-hcxt,14:17)確認 spinner 不收。HAR 裡 `GET /interconnect/serviceMesh` 200 有資料;access.log 到 01:44Z 也全 200、無 4xx/5xx。
mesh 記錄的 `lastTaskDetails` 指向兩個 RUNNING 任務(07-13 / 09-08 起);⚠ bundle 的 postgresExport 是 pg_dump custom 格式、看起來只有 schema/函式,
**無法證明這兩筆任務還在不在 DB**(先前「已被清掉」是誤判,現場要 `psql -U admin -d hybridity` 查)。推測 UI 針對 RUNNING 任務拉進度拿不到而卡住 —— 需要現場開 DevTools 看 pending 的那個 request 確認;
若是這條,現場處理 = 對 mesh 做 Resync 讓 lastTaskDetails 換成新任務(或請 Broadcom 清 DB 欄位)。

## 🎯 目標修正(2026-09-30 20:5x):客戶要的是「讓 VCF 9 升級走下去」
現況:Manager 已 9.1.1;卡在 Service Mesh → Update Appliances;**IX VM 在 vCenter 已不存在**(只剩 HCX DB 記錄 + 卡住的 resync 任務)。
→ 不修 thumbprint,改 **force-delete 殘留 mesh 再重建**。
- API:`DELETE /hybridity/api/interconnect/serviceMesh/{id}?force=true`(= UI Delete + Force)。**要在發起站(hcxt,isInitiator=true)執行**。
- 目標 mesh:`servicemesh-fb5509e1-b47b-4166-a130-491380284922`(esbvcsa01-sddctestvcsa)。
  `default-service-mesh-379b96be`(auto self-site,HCX Assisted vMotion)是系統的,**不要刪**。
- 腳本:`E:\9.1\esun-hcx\Remove-StaleServiceMesh.ps1`(先列出、確認後才刪、會 poll task)。
- 刪完:Appliances 列表應無 IX;若殘留 → `DELETE /hybridity/api/interconnect/appliances/{id}?force=true`。
- 重建 mesh 時若精靈有 modern appliance architecture 選項就選它(HBRSRV_UW 路徑,程式碼裡不做 hostname 驗證);
  用 legacy 重建則之後仍會噴 ThumbprintExchanger,屆時用「匯入 IX 8123 憑證」那招。


### DB 直查(lab 實測)
HCX Manager 上 **admin 就能 `psql -U admin -d hybridity -h localhost`**(表 owner=admin),不用 root;python3 3.14 + requests 也在,`https://localhost` 可直接打 API。

## Lab 完整測試計畫(等 NSX;使用者決定不自部 NSX)
pairing 兩個方向都實測被擋(`not permitted without registering a valid NSX-T Manager`),目的端一定要 NSX。NSX 起來後:
1. `bash E:\9.1\hcx-mesh-after-nsx.sh https://vcf-m02-nsx01a.home.lab admin '<pw>'` → NSX 註冊 → pairing → mesh(IX 9.1.1 兩端)。
2. 觀察 `/common/logs/admin/app.log` 有無 `ThumbprintExchanger … does not match`(回答 B 問題:9.1.1+9.1.1 還會不會炸)。
   若炸 → 9443 匯入 IX `https://<IX IP>:8123` 憑證 → 看下一輪是否消失(驗證旁路)。
3. 模擬客戶狀態:在 vCenter 直接關機+刪除 IX VM(兩端),再按 mesh「Update Appliances」讓它卡住。
4. 在發起站用 `python3 /tmp/hcx_force_delete_mesh.py --user administrator@vsphere.local --delete --mesh-id <id>` force-delete;
   確認兩端 mesh/appliances 清空;若被 RUNNING task 擋 → `psql -U admin -d hybridity` 查任務/lastTaskDetails 再處理。
5. 重建 mesh 看能否正常完成 = 客戶升級能走下去的等價驗證。

現場可用的東西(已在 lab 9.1.1 Manager 上驗過能跑):`E:\9.1\esun-hcx\hcx_force_delete_mesh.py`(admin SSH 進 Manager 直接跑,
python3 3.14 + requests 內建,打 https://localhost)、`psql -U admin -d hybridity -h localhost` 直查。

### 跨 session 對帳(2026-09-30 21:0x)
- VCF session 已跟使用者確認改走 **變體 A**(部 NSX、無 overlay);NSX vcf-m02-nsx01a/10.0.1.20、VIP 10.0.1.21 要等 converge 跑完;密碼屆時回報。
- 更正:HCX 9.1.1 在 9443 註冊 vCenter **不會**在 vCenter 寫 com.vmware.hcx extension(10.0.1.19 與外層皆為 0 筆)。
- hcx02 註冊對象 = 今天新建的 M02 vCenter(vcuuid 7cd5913a… 與 govc about 一致,status OK,inventory sync 正常)。

## 🔑 Lab 實測(2026-09-30 22:5x~):9.1.1 新建 mesh 一律 EDGE(modern),PHOTON 給不了
- NSX 9.1.1(vcf-m02-nsx01a,vtepless)註冊 hcx02 OK;hcx01→hcx02 site pairing OK(job f2e70736)。
- `POST /interconnect/serviceMesh` 帶 `"backingApplianceType":"PHOTON"` + INTERCONNECT only → 仍回
  `INTERCONNECT service with EDGE appliances requires at least one migration service` → **9.1.1 已不讓新 mesh 走 legacy PHOTON/IX**。
- 加 VMOTION+BULK_MIGRATION 後建立成功:mesh `servicemesh-fab31466-d32c-4c84-ae8d-561f287df3eb`(outer-to-m02),
  backingApplianceType=**EDGE**,appliance 型別 **HCX-WAN-IX-EDGE**(IXE-I1 在外層 / IXE-R1 在 M02)。
- 對客戶的意義:force-delete 舊 mesh 後**重建出來的必然是 EDGE(HBRSRV_UW 路徑,程式碼裡 hostnameVerifierOff)**,
  ThumbprintExchanger 那個 hostname 驗證問題在重建後理論上不會再出現 —— 等 IXE 上線後用 app.log 驗。

### ✅ mesh 建好(2026-09-30 15:09Z):EDGE / IXE 兩端 CONFIGURED、tunnel up、INTERCONNECT/VMOTION/BULK_MIGRATION 全 up
- IXE-I1(外層,host .95):mgmt 10.0.0.87,HBR/migration IP **10.0.0.88:8123**;IXE-R1(M02,esx02):mgmt 10.0.1.27,HBR 10.0.1.28:8123。
- 部署中(15:05Z)hcx01 有一次 `Error adding lwd proxy … NoRouteToHost 10.0.0.88:8123`(appliance 還沒起來),**不是** hostname 錯;
  `does not match the certificate subject` 全程 0 筆(hcx01、hcx02 皆 0)。
- 🔑 **關鍵差異找到了**:9.1.1 IXE 的 HBR 憑證(8123)SAN 含 **`IP Address:10.0.0.88`(自己的 HBR IP)+ DNS:outer-to-m02-IXE-I1**,
  所以嚴格 hostname 驗證直接通過。客戶 9.1.0.x legacy IX 的 HBR 憑證只有 CN=VMware vSphere Replication Server(從錯誤訊息看無 IP SAN)→ 9.1.1 Manager 一驗就炸。
  → 結論:**Manager 9.1.1 + 舊 IX(無 IP SAN 憑證)= 必炸;換成 9.1.1 appliance(EDGE)= 憑證帶 IP SAN,正常。**
  客戶正解 = 讓 appliance 跟上 9.1.1(Update Appliances / 重建 mesh);過渡期才用「匯入 IX 憑證」旁路。
- 穩態驗證(15:20Z 週期 PeriodicThumbprintExchanger):3 台 host ↔ IXE-I1 thumbprint 交換全部成功、`Started hbrsrvuw in host-*`;
  `does not match the certificate subject` 仍 0 筆;唯一 1 筆 `Error adding lwd proxy` 是部署中 NoRouteToHost(暫時)。→ **B 問題答案:9.1.1 Manager + 9.1.1 appliance 不會炸。**
- Mobility Agent host 已加進兩邊 vCenter(`/Datacenter/host/10.0.0.88`、`/vcf-m02-dc01/host/10.0.1.28`)—— 砍 IX 模擬時要記得這兩個 MA host 也會變孤兒,force-delete 後檢查是否被清掉。

## ✅ 模擬客戶狀態 + force-delete 實測(2026-10-01 00:16Z~00:3xZ)
1. 兩邊 vCenter 直接 power-off + destroy IXE-I1 / IXE-R1(= 客戶「IX 不見了」)。
2. 對 mesh 做 resync(= 客戶的 Update Appliances / resyncServiceMesh 類操作):task 1b941881 跑到
   `[IXE-I1] Update VM networks failed` → **FAILED**;但 mesh 的 `lastTaskDetails` 仍是 `resyncServiceMesh/RUNNING`、state=UPDATE_FAILED
   → **證明 lastTaskDetails 不會跟著 task 結果更新**,這就是客戶 HAR 裡 resync「永遠 RUNNING」(09-08 起)的來源。
3. 在發起站 hcx01 跑 `python3 /tmp/hcx_force_delete_mesh.py --delete --mesh-id … `(force=true):
   `Removing appliances → Syncing records → Service mesh deleted`,SUCCESS,約 3 分鐘。
4. 結果:hcx01 mesh 0 / appliances 0;hcx02 只剩系統自動的 `default-service-mesh-7cd5913a`(跟客戶的 default-service-mesh-379b96be 同類,**不要刪**)、appliances 0;
   兩邊 compute profile 完好(VALID);**兩邊 vCenter 的 Mobility Agent host(10.0.0.88 / 10.0.1.28)也被一併移除**,沒有孤兒。
→ 客戶現場照這個流程做即可:在 hcxt(發起站)跑腳本 force-delete `servicemesh-fb5509e1-…`,之後重建 mesh(9.1.1 一律 EDGE)。

## 對照:客戶 log 狀態 vs lab 重現狀態
| 面向 | 客戶(sddc-hcxt / hcxt bundle + HAR) | Lab(hcx01 / hcx02) |
|---|---|---|
| mesh 記錄 | `esbvcsa01-sddctestvcsa` state=COMMITTED,`lastTaskDetails=resyncServiceMesh/RUNNING`(task 6bbdfde8,09-08 起) | `outer-to-m02` state=UPDATE_FAILED,`lastTaskDetails=resyncServiceMesh/RUNNING`(task 1b941881) |
| 那個 resync 任務實際怎樣 | job.log 09-08 02:11:16 最後一行 `initiateServiceMeshOperation State:INITIATE_CONFIGURE_UNDERLAY_METRICS_COLLECTION`,之後**兩邊 log 再無任何該任務記錄**(09-09~09-30 皆 0 筆)= 工作流中途消失,從未 COMPLETE/FAILED | task 跑到 `[IXE-I1] Update VM networks failed` → **FAILED**(有終態) |
| lastTaskDetails 是否回寫 | 否(永遠 RUNNING) | 否(task FAILED 後仍 RUNNING)→ **同一個行為**:lastTaskDetails 不隨 task 終態更新 |
| IX 狀態 | IX VM 不在 vCenter;09-08 就有 `MA Host not available to disconnect: 172.17.72.142` | IX VM 已 destroy;resync 時 `InterconnectRedeploy … Failed to reattach networks to old appliance`、`CHECK_IX_REACHABILITY` 失敗 |
| 其他噪音 | `No config found for applianceType: servicemesh-…`、`PortConfig empty … DEFAULT ports`(09-08) | (未見) |
| force-delete | 未做(UI 卡 Loading) | `DELETE …/serviceMesh/{id}?force=true` → `VM with moref vm-17844 not found … Skipping delete VM` → 釋放 IP、移除 trusted cert、刪 MA host → **SUCCESS 3 分鐘**,兩端乾淨 |
差異提醒:客戶的 resync 是「中途消失、無終態」,lab 是「明確 FAILED」。若現場 force-delete 被「operation in progress」擋,先在 9443 重啟 APPENGINE
(`toggleComponentStatus APPENGINE RESTART`,清掉記憶體內的 job 狀態)再刪;仍擋就 `psql -U admin -d hybridity` 看 mesh 記錄的 lastTaskDetails。
另:lab 刪除 log 顯示 HCX 在部署時會把 IX 憑證存進 trusted certificate bucket(`Remove trusted certificate for appliance … SHA256`),
刪除時一併移除 —— 這也解釋 9.1.1 appliance 為何過得了 hostname 驗證(憑證在信任清單 + SAN 有 IP,雙保險)。
5. **重建 mesh 成功**(task 1fab701f,15 分鐘):新 mesh `servicemesh-d04c49c3-6c80-4b55-8a8a-e6b68aa02f97`,IXE-I1 / IXE-R1 重新部署、
   `Configure mobility agent host complete` 兩端、underlay metrics 完成。→ 「force-delete → 重建」整條路在 9.1.1 上閉環驗證完成。
   目前 lab 狀態:mesh outer-to-m02(新)在線,IXE 兩台存活,hcx01/hcx02 各一座 default self-site mesh。
