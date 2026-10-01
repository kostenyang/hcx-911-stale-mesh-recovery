const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, PageBreak, BorderStyle, LevelFormat } = require('docx');
const fs = require('fs');
const OUT = 'E:\\9.1\\HCX911-StaleMesh-Recovery-Report.docx';
const C = { blue: '1F4E79', gray: '595959', red: 'C00000', green: '2E7D32', amber: 'B77E00' };
const H1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 340, after: 160 } });
const H2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 } });
const P = (t, o = {}) => new Paragraph({ children: [new TextRun({ text: t, size: o.size || 21, bold: o.bold, color: o.color, italics: o.italics })], spacing: { after: o.after != null ? o.after : 110 }, alignment: o.align });
const CODE = t => new Paragraph({ children: t.split('\n').map((ln, i) => new TextRun({ text: ln, font: 'Consolas', size: 16, break: i ? 1 : 0 })), shading: { type: ShadingType.CLEAR, fill: 'F4F4F4' }, spacing: { before: 70, after: 70 }, indent: { left: 220 } });
const BULLET = (t, lvl = 0) => new Paragraph({ children: [new TextRun({ text: t, size: 21 })], numbering: { reference: 'bul', level: lvl }, spacing: { after: 70 } });
const NUM = (t) => new Paragraph({ children: [new TextRun({ text: t, size: 21 })], numbering: { reference: 'num', level: 0 }, spacing: { after: 70 } });
const NOTE = (t, fill, color) => new Paragraph({ children: [new TextRun({ text: t, size: 20, color: color || C.gray })], shading: { type: ShadingType.CLEAR, fill: fill || 'FFF6E5' }, spacing: { before: 90, after: 90 }, indent: { left: 120, right: 120 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: color || C.amber } } });
const TOTAL = 9000;
function table(headers, rows, pct) {
  const widths = pct.map(p => Math.round(TOTAL * p / 100));
  const cell = (t, i, hdr, ri) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: hdr ? { type: ShadingType.CLEAR, fill: C.blue } : (ri % 2 ? { type: ShadingType.CLEAR, fill: 'F7F9FC' } : undefined), children: String(t).split('\n').map(ln => new Paragraph({ children: [new TextRun({ text: ln, bold: hdr, color: hdr ? 'FFFFFF' : undefined, size: hdr ? 19 : 18 })] })) });
  return new Table({ rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true, 0)) })].concat(rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, i, false, ri)) }))), columnWidths: widths, width: { size: TOTAL, type: WidthType.DXA } });
}
const SP = () => new Paragraph({ text: '', spacing: { after: 60 } });
const BR = () => new Paragraph({ children: [new PageBreak()] });
const ch = [];

// 封面
ch.push(new Paragraph({ text: '', spacing: { before: 2200 } }));
ch.push(new Paragraph({ children: [new TextRun({ text: 'VCF Operations HCX 9.1.1', size: 40, bold: true, color: C.blue })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
ch.push(new Paragraph({ children: [new TextRun({ text: '升級後 Service Mesh 卡住與 IX 遺失:根因分析、Lab 重現與現場修復程序', size: 30, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }));
ch.push(new Paragraph({ children: [new TextRun({ text: '內部技術報告', size: 24, color: C.gray })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }));
ch.push(new Paragraph({ children: [new TextRun({ text: '案例:玉山銀行 HCX 升級 9.1.1(2026-09-30)/ Lab 驗證:VCF 9.1.1 nested lab(2026-09-30 ~ 10-01)', size: 20, color: C.gray })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }));
ch.push(new Paragraph({ children: [new TextRun({ text: '版本 1.0 — 2026-10-01', size: 20, color: C.gray })], alignment: AlignmentType.CENTER }));
ch.push(BR());

// 目錄(靜態)
ch.push(H1('目錄'));
['摘要', '1. 背景與客戶環境', '2. 症狀', '3. 根因分析', '4. Lab 重現與對照', '5. 現場修復程序(SOP)', '6. 注意事項與已知坑', '附錄 A:HCX API 配方', '附錄 B:交付腳本', '附錄 C:時間軸'].forEach(t => ch.push(P(t, { after: 40 })));
ch.push(BR());

// 摘要
ch.push(H1('摘要'));
ch.push(P('客戶將五座 HCX Manager 升級至 9.1.1 後,測試對(hcxt → sddc-hcxt)的 Service Mesh 在「Update Appliances」階段卡住、UI 的 Service Mesh 清單永遠停在 Loading,且 IX appliance VM 已不存在於 vCenter。客戶的目標是「讓 VCF 9 升級能繼續往下走」。'));
ch.push(P('本報告由 5 份 HCX support bundle 與 1 份 HAR 判讀出兩個獨立問題,並在 lab 以同版本(9.1.1.0.25690219)完整重現與驗證修法:'));
ch.push(BULLET('問題 A — ThumbprintExchanger 憑證主機名驗證失敗:9.1.1 Manager 以 HttpClient5 嚴格驗證 IX HBR(port 8123)憑證的主機名;舊版 IX 的憑證沒有 IP SAN,五座 Manager 升級後全部每 15 分鐘噴錯。9.1.1 新 appliance 的 HBR 憑證帶 IP SAN,且 Manager 會把 appliance 憑證存入信任清單,故不受影響。'));
ch.push(BULLET('問題 B — mesh 殘留與 lastTaskDetails 不回寫:IX VM 已遺失,resync 工作流中途消失;mesh 記錄的 lastTaskDetails 永遠 RUNNING(lab 證實 task 失敗後亦不回寫),UI 因而卡住。'));
ch.push(P('修法(lab 全程驗證):在發起站以 API force-delete 殘留 mesh(約 3 分鐘,Mobility Agent host 一併清除)→ 重建 mesh(9.1.1 一律產生 EDGE 架構 appliance,約 15 分鐘)。重建後憑證問題不再出現(0 筆)。過渡期若舊 IX 仍須運作,可將 IX :8123 憑證匯入 Manager 9443 的 Trusted Certificates 以跳過主機名驗證(機制已於 lab 驗證)。', { bold: true }));
ch.push(BR());

// 1
ch.push(H1('1. 背景與客戶環境'));
ch.push(P('資料來源:5 份 HCX Manager support bundle(皆 9.1.1.0.25690219,2026-09-30 01:40–01:43Z 收集)、sddc-hcxt 的 HAR(06:20Z)、使用者提供的 UI 截圖(14:17 本地時間)。'));
ch.push(table(['Bundle id', 'Hostname', '角色', '升級 9.1.1 時間(UTC)'], [
  ['06358e', 'mgt-hcx.esunbank.com.tw', '管理域', '2026-09-24 07:58'],
  ['4187a0', 'sddc-hcx.esunbank.com.tw', 'SDDC(接 mgt / prd 兩個來源)', '2026-09-24 07:29'],
  ['ccf0bd', 'prd-hcx.esunbank.com.tw', '正式', '2026-09-24 07:58'],
  ['0fee91', 'hcxt.esunbank.com.tw', '測試來源(vC esbvcsa01 8.0.3)', '2026-09-29 06:55'],
  ['6f5de1', 'sddc-hcxt.esunbank.com.tw(172.17.72.141)', '測試目標(VCF 9.1:vC sddc-testvcsa 9.1.0.0300、NSX 9.1.0)', '2026-09-29 06:29'],
], [12, 30, 36, 22]));
ch.push(SP());
ch.push(P('測試對的 Service Mesh:esbvcsa01-sddctestvcsa(INTERCONNECT,backing PHOTON,IX-R1 = c9954711…)。另有系統自動建立的 default-service-mesh-379b96be(HCX Assisted vMotion,self-site pair),此為系統物件,不可刪除。'));

// 2
ch.push(H1('2. 症狀'));
ch.push(H2('2.1 UI 與 API'));
ch.push(BULLET('sddc-hcxt UI → Interconnect → Service Mesh:永遠「Loading service mesh list…」。'));
ch.push(BULLET('HAR:GET /hybridity/api/interconnect/serviceMesh 回 200,兩個 mesh 皆帶 RUNNING 的 lastTaskDetails:esbvcsa01-sddctestvcsa = resyncServiceMesh(task 6bbdfde8,2026-09-08 起)、default-service-mesh = autoSelfSiteServiceMeshCreate(task 0344e183,2026-07-13 起)。'));
ch.push(BULLET('mesh updateAvailable = true(appliance 仍 9.1.0.x),Update Appliances 無法完成;IX VM 已不在 vCenter。'));
ch.push(H2('2.2 Log'));
ch.push(P('五座 Manager 的 app.log 在各自升級當天起,每約 15 分鐘出現同一組錯誤(升級前零筆):'));
ch.push(CODE('ERROR [ThumbprintExchanger] Error adding lwd proxy as trusted site to connection broker in appliance c9954711-…\n  java.lang.RuntimeException: Error Running request  (HbrServerInstance.login -> loginBySSLCertificate)\nCaused by: PeerNotVerifiedException: Host name \'172.17.72.142\' does not match the certificate subject\n  provided by the peer (CN=VMware vSphere Replication Server, OU=VMware vSphere Replication Server Certificate, O="VMware, Inc" ...)\n  at org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory.verifyHostname'));
ch.push(table(['Manager', '命中數', '失敗對端(IX HBR IP)'], [
  ['mgt-hcx', '2188', '172.17.79.134'], ['sddc-hcx', '4376', '172.17.79.131 / .132'], ['prd-hcx', '2188', '172.17.72.145'], ['hcxt', '300', '172.17.72.139'], ['sddc-hcxt', '308', '172.17.72.142'],
], [30, 20, 50]));
ch.push(SP());
ch.push(P('其他次要訊息:NsxTInventorySyncJob 同步 traffic group 回 500(目標端 NSX 9.1.0)、Phonehome 上傳 timeout(air-gap,可忽略)。'));
ch.push(H2('2.3 卡住的 resync 任務'));
ch.push(P('hcxt(發起站)job.log 2026-09-08 02:11:16 該任務最後一行為 initiateServiceMeshOperation State:INITIATE_CONFIGURE_UNDERLAY_METRICS_COLLECTION,之後兩邊 log 直到 09-30 再無任何該任務記錄 —— 工作流中途消失,從未到達 COMPLETE/FAILED。目標端 09-08 已有「MA Host not available to disconnect: 172.17.72.142」,顯示 IX 當時即已不可達。'));

// 3
ch.push(H1('3. 根因分析'));
ch.push(H2('3.1 程式碼層(反編譯 lab 9.1.1 Manager 之 jar)'));
ch.push(table(['Jar', '類別', '位置'], [
  ['interconnect-service-1.0.jar', 'ThumbprintExchanger / PeriodicThumbprintExchanger', '/opt/vmware/Services/interconnect-service_1.0/'],
  ['lib_unified_hbr_adapter-1.0.jar', 'HbrServerInstance / HbrConnection / UnifiedVrAdapterFactory', '/opt/vmware/Adapters/1.0/'],
  ['lib_https_adapter-1.0.jar', 'HttpsAdapter / SslHostnameVerifier / Constants', '/opt/vmware/Adapters/1.0/'],
  ['lib_keymanager-1.0.jar', 'KeyManager(trusted certificate bucket)', '/opt/vmware/third-party/'],
], [30, 40, 30]));
ch.push(SP());
ch.push(P('呼叫鏈:ThumbprintExchanger.getConnectionBrokerInstance → SERVER_TYPE HBRSRV_CONNECTION_BROKER → UnifiedVrAdapterFactory.getHbrServerInstance(ip, "9.0.0.0", …, certAuth=true) → new HbrConnection(ip, …)(預設 HBRSRV_NOW,port 8123)→ hostnameVerifier(Constants.DEFAULT_HOSTNAME_VERIFIER)。只有 HBRSRV_UW(ESX 內建 hbrsrvuw,port 443)路徑會呼叫 hostnameVerifierOff()。'));
ch.push(CODE('// SslHostnameVerifier.verify()\nString sha256 = getLeafCertificateSha256(session);\nKeyStore ks = loadCertificate(sha256);            // KeyManager.loadTrustedCertificates(ks, [sha256])\nboolean ok = optCert.isPresent() || delegate.verify(host, session);   // 信任清單有此憑證 -> 跳過主機名驗證\nif (!ok) throw new UnverifiedPeerException("Host name ... does not match the certificate subject ...");'));
ch.push(P('KeyManager.loadTrustedCertificates 查 Postgres certstore 集合、bucket "trusted certificate" —— 即 Appliance Management(9443)→ Administration → Trusted Certificates 所寫入的 bucket。'));
ch.push(H2('3.2 憑證層(lab 實測)'));
ch.push(BULLET('9.1.1 新 appliance(HCX-WAN-IX-EDGE)在 8123 呈現的 HBR 憑證 SAN 含自己的 HBR IP 與 appliance 名稱(例:IP Address:10.0.0.88, DNS:outer-to-m02-IXE-I1)→ 嚴格驗證通過。'));
ch.push(BULLET('Manager 於部署 appliance 時將其憑證存入 trusted certificate bucket(刪除時 log 可見 Remove trusted certificate for appliance … SHA256)→ 雙保險。'));
ch.push(BULLET('客戶 9.1.0.x 舊 IX 的憑證僅 CN=VMware vSphere Replication Server、無 IP SAN(錯誤訊息印出之 subject),升級後的 Manager 一驗即失敗。'));
ch.push(NOTE('結論:Manager 9.1.1 + 舊版 IX(憑證無 IP SAN)必然失敗;appliance 升到 9.1.1 或重建 mesh 後即正常。過渡期可將 IX :8123 憑證匯入 Trusted Certificates 以跳過主機名驗證。', 'E8F5E9', C.green));
ch.push(H2('3.3 UI 卡住與 lastTaskDetails'));
ch.push(P('lab 證實:resync task 明確 FAILED 後,mesh 記錄的 lastTaskDetails 仍停在 resyncServiceMesh/RUNNING,顯示此欄位不隨 task 終態更新。客戶的 resync 更是中途消失、無終態,故永遠 RUNNING;UI 的 mesh 清單依此狀態等待而卡在 Loading。'));

// 4
ch.push(H1('4. Lab 重現與對照'));
ch.push(H2('4.1 環境'));
ch.push(table(['', 'hcx01(來源)', 'vcf-m02-hcx(目標)'], [
  ['HCX Manager', '10.0.0.86,9.1.1.0.25690219', '10.0.1.26,9.1.1.0.25690219'],
  ['vCenter', 'labvc.lab.com 8.0.3(外層)', 'vcf-m02-vc01.home.lab 9.1.1(VCF 9.1.1 nested,converge 中)'],
  ['NSX', '—', 'vcf-m02-nsx01a 9.1.1(vtepless;目的端必要條件)'],
  ['Network / Compute profile', 'np-mgmt-outer 10.0.0.87-93 / cp-outer', 'np-mgmt-m02 10.0.1.27-35 / cp-m02'],
  ['Mesh', 'outer-to-m02:INTERCONNECT + VMOTION + BULK_MIGRATION,backing EDGE', ''],
], [24, 38, 38]));
ch.push(SP());
ch.push(P('重要前置:HCX site pairing 要求目的端 HCX 已註冊 NSX-T Manager(兩個方向皆實測被擋);且 9.1.1 不允許新 mesh 使用 legacy PHOTON appliance(指定 PHOTON 仍回「INTERCONNECT service with EDGE appliances requires at least one migration service」)。'));
ch.push(H2('4.2 步驟與結果'));
ch.push(NUM('建立 mesh(EDGE):IXE-I1(外層,mgmt 10.0.0.87 / HBR 10.0.0.88)與 IXE-R1(M02,10.0.1.27 / 10.0.1.28)上線,tunnel up,三項服務 up;Mobility Agent host 10.0.0.88 / 10.0.1.28 加入兩邊 vCenter。'));
ch.push(NUM('穩態觀察:PeriodicThumbprintExchanger 成功交換 host ↔ appliance thumbprint、Started hbrsrvuw;「does not match the certificate subject」兩邊 0 筆。'));
ch.push(NUM('模擬客戶:在兩邊 vCenter power-off + destroy 兩台 IXE VM。'));
ch.push(NUM('對 mesh 執行 resync(等同 Update Appliances 類操作):task 進到 [IXE-I1] Update VM networks failed → FAILED;mesh state=UPDATE_FAILED,lastTaskDetails 仍 resyncServiceMesh/RUNNING。'));
ch.push(NUM('在發起站 hcx01 執行 hcx_force_delete_mesh.py --delete(DELETE …/serviceMesh/{id}?force=true):Removing appliances → Syncing records → Service mesh deleted,SUCCESS 約 3 分鐘。log:VM with moref vm-17844 not found … Skipping delete VM → 釋放 IP → 移除 trusted certificate → 刪 MA host。'));
ch.push(NUM('驗證:兩邊 mesh 0(僅剩系統 default-service-mesh)、appliances 0、compute profile 完好、兩邊 vCenter 之 MA host 已移除。'));
ch.push(NUM('重建 mesh:task SUCCESS 約 15 分鐘,IXE 重新部署、Configure mobility agent host complete。'));
ch.push(H2('4.3 對照表:客戶 log 狀態 vs lab'));
ch.push(table(['面向', '客戶(bundle + HAR)', 'Lab'], [
  ['mesh 記錄', 'COMMITTED,lastTaskDetails = resyncServiceMesh/RUNNING(09-08 起)', 'UPDATE_FAILED,lastTaskDetails = resyncServiceMesh/RUNNING'],
  ['resync 實際結局', '09-08 02:11:16 後兩邊 log 再無記錄 = 中途消失、無終態', '[IXE-I1] Update VM networks failed → 明確 FAILED'],
  ['lastTaskDetails 回寫', '否(永遠 RUNNING)', '否(FAILED 後仍 RUNNING)— 同一行為'],
  ['IX 狀態', 'VM 不在;MA Host not available to disconnect: 172.17.72.142', 'VM 已 destroy;InterconnectRedeploy … Failed to reattach networks to old appliance'],
  ['force-delete', '未做(UI 卡 Loading)', 'SUCCESS 3 分鐘,兩端乾淨、MA host 一併清除'],
  ['重建', '—', 'SUCCESS 15 分鐘,EDGE appliance,憑證問題 0 筆'],
], [20, 42, 38]));

// 5
ch.push(BR());
ch.push(H1('5. 現場修復程序(SOP)'));
ch.push(NOTE('目標:清除 IX 已遺失的殘留 mesh,使 VCF 9 升級 / 後續重建得以進行。所有操作在「發起該 mesh 的 HCX Manager」(isInitiator=true;測試對為 hcxt)上以 admin SSH 執行,不經 UI。', 'FFF6E5', C.amber));
ch.push(H2('5.1 前置'));
ch.push(BULLET('SSH admin 登入 hcxt.esunbank.com.tw;Manager 內建 python3(3.14)與 requests,可直接打 https://localhost。'));
ch.push(BULLET('上傳 hcx_force_delete_mesh.py 至 /tmp(scp 或貼上)。'));
ch.push(BULLET('確認 vCenter 中 IX VM 確實不存在(若存在則先 power-off 並刪除,或改走正常 Delete)。'));
ch.push(H2('5.2 列出現況'));
ch.push(CODE("python3 /tmp/hcx_force_delete_mesh.py --user 'svc_hcx@ESB.LOCAL'"));
ch.push(P('確認要刪的 mesh 為 esbvcsa01-sddctestvcsa(servicemesh-fb5509e1-b47b-4166-a130-491380284922),且 default-service-mesh-* 不在刪除範圍(腳本會擋)。'));
ch.push(H2('5.3 強制刪除'));
ch.push(CODE("python3 /tmp/hcx_force_delete_mesh.py --user 'svc_hcx@ESB.LOCAL' --delete --mesh-id servicemesh-fb5509e1-b47b-4166-a130-491380284922\n# 等同 DELETE /hybridity/api/interconnect/serviceMesh/{id}?force=true;腳本會 poll task 至終態並再列一次"));
ch.push(P('預期:Removing appliances → Syncing updated records → Service mesh deleted(SUCCESS)。'));
ch.push(H2('5.4 驗證'));
ch.push(BULLET('兩邊 Manager:serviceMesh 只剩 default-service-mesh;appliances 為 0;compute profile 仍 VALID。'));
ch.push(BULLET('兩邊 vCenter:Hosts 清單中不應再有 IX 的 Mobility Agent host(172.17.72.142 等);若殘留,手動 Remove Host。'));
ch.push(BULLET('若 appliance 記錄殘留:DELETE /hybridity/api/interconnect/appliances/{id}?force=true。'));
ch.push(H2('5.5 重建 mesh'));
ch.push(BULLET('以 UI 或 API 重建;9.1.1 一律產生 EDGE 架構 appliance(憑證帶 IP SAN),ThumbprintExchanger 問題不會再出現。'));
ch.push(BULLET('mesh 的 services 至少含一項遷移服務(VMOTION / BULK_MIGRATION / RAV / OS_ASSISTED_MIGRATION),否則 9.1.1 拒絕建立。'));
ch.push(H2('5.6 若 force-delete 被擋'));
ch.push(BULLET('回「operation in progress」:於 9443 重啟 APPENGINE(jsonrpc toggleComponentStatus APPENGINE RESTART)清除記憶體內 job 狀態後重試。'));
ch.push(BULLET('仍擋:psql -U admin -d hybridity -h localhost 檢視 mesh 記錄之 lastTaskDetails,再決定是否由 Broadcom 支援協助清理。'));
ch.push(H2('5.7 過渡旁路(舊 IX 仍須運作時)'));
ch.push(P('對每座 Manager,將其 IX 的 HBR 憑證匯入 9443 → Administration → Trusted Certificates(Import → URL:https://<IX IP>:8123;URL 不吃 port 時以 openssl s_client -connect <IX IP>:8123 -showcerts 取 leaf PEM 貼上)。下一輪 PeriodicThumbprintExchanger(≤15 分)或 mesh Resync 後,app.log 不應再出現該錯誤。'));
ch.push(table(['Manager', 'IX HBR IP(匯入來源)'], [['mgt-hcx', '172.17.79.134'], ['sddc-hcx', '172.17.79.131、172.17.79.132'], ['prd-hcx', '172.17.72.145'], ['hcxt', '172.17.72.139'], ['sddc-hcxt', '172.17.72.142']], [40, 60]));

// 6
ch.push(H1('6. 注意事項與已知坑'));
ch.push(BULLET('default-service-mesh-*(HCX Assisted vMotion self-site)為系統物件,勿刪;其 autoSelfSiteServiceMeshCreate 任務顯示 RUNNING 亦是 lastTaskDetails 未回寫,job log 早已 COMPLETE。'));
ch.push(BULLET('bundle 內 postgresExport 為 pg_dump custom 格式且僅含 schema,無法據以判斷任務是否仍在 DB;需現場 psql。'));
ch.push(BULLET('9443 config API 的密碼欄位一律 base64(UI 以 btoa 傳送);給明文會得到 vCenter 的 expat「reference to invalid character number」假錯。'));
ch.push(BULLET('9443 註冊 vCenter 不會在 vCenter 建立 com.vmware.hcx extension;憑證信任流程為「先 POST 取回 Untrusted SSL 的 certificate → POST /api/admin/certificates 匯入 → 重送」。'));
ch.push(BULLET('hybridity API:network profile 須 l3TenantManaged:false;site pairing body 須 {"remote":{url,username,password}};目的端須已註冊 NSX。'));
ch.push(BULLET('9.1.1 appliance 部署期間 ThumbprintExchanger 可能短暫報 NoRouteToHost <HBR IP>:8123,屬暫時性,與憑證無關。'));
ch.push(BULLET('Manager 的 admin 不在 sudoers;需 root 時用 su -(root 不可直接 SSH)。admin 可直接 psql -U admin -d hybridity。'));

// 附錄 A
ch.push(BR());
ch.push(H1('附錄 A:HCX API 配方'));
ch.push(P('API 說明在 https://<hcx>/hybridity/docs/,spec 於 /hybridity/docs/apis/<component>/<schema>;hybridity API token = POST /hybridity/api/sessions 回應之 x-hm-authorization。'));
ch.push(table(['用途', '呼叫'], [
  ['9443 設定(vcenter / lookupservice / nsx)', 'POST /api/admin/global/config/<section>  body {"data":{"items":[{"config":{...,"password":"<base64>"},"section":"<section>"}]}}'],
  ['9443 匯入信任憑證', 'POST /api/admin/certificates  {"certificate":"<base64 DER>"}'],
  ['重啟 app engine', 'POST /api/1.0/appliance-management/jsonrpc/components  {"method":"toggleComponentStatus","params":["APPENGINE","RESTART"]}'],
  ['Network profile', 'POST /admin/hybridity/api/networks(l3TenantManaged:false)'],
  ['Compute profile', 'POST /hybridity/api/interconnect/computeProfiles(/preview 先驗)'],
  ['Site pairing', 'POST /hybridity/api/cloudConfigs  {"remote":{"url","username","password"}}'],
  ['Service mesh', 'POST /hybridity/api/interconnect/serviceMesh;GET .../tasks/{id} 追蹤'],
  ['Mesh resync', 'POST /hybridity/api/interconnect/serviceMesh/{id}/resync'],
  ['Mesh 強制刪除', 'DELETE /hybridity/api/interconnect/serviceMesh/{id}?force=true'],
  ['Appliance 強制刪除', 'DELETE /hybridity/api/interconnect/appliances/{id}?force=true'],
], [30, 70]));

// 附錄 B
ch.push(H1('附錄 B:交付腳本'));
ch.push(table(['檔案', '用途'], [
  ['scripts/hcx_force_delete_mesh.py', '現場用:Manager 內 admin 直接 python3 執行;列出 mesh/appliance、--delete 強制刪除並 poll task'],
  ['scripts/Remove-StaleServiceMesh.ps1', '同功能 PowerShell 版(跳板機執行)'],
  ['scripts/hcx-mesh-after-nsx.sh', 'lab:NSX 註冊 → site pairing → 建 mesh'],
  ['scripts/deploy-hcx01.sh / deploy-hcx02.sh', 'lab:ovftool 部署 HCX Unified Appliance'],
  ['docs/analysis-and-lab-log.md', '完整分析與工作紀錄(含所有 log 片段)'],
], [40, 60]));

// 附錄 C
ch.push(H1('附錄 C:時間軸'));
ch.push(table(['時間', '事件'], [
  ['2026-09-24', 'mgt-hcx / sddc-hcx / prd-hcx 升 9.1.1,當天起 ThumbprintExchanger 錯誤'],
  ['2026-09-29', 'hcxt / sddc-hcxt 升 9.1.1,同樣錯誤出現'],
  ['2026-09-30', '收到 bundle + HAR;判讀根因;lab 部署 hcx01 / vcf-m02-hcx、反編譯 jar、驗證信任清單旁路'],
  ['2026-09-30 深夜', 'M02 converge(變體 A)部出 NSX;lab 建 mesh(EDGE),穩態 0 錯'],
  ['2026-10-01', '砍 IX → resync 卡 → force-delete SUCCESS → 重建 SUCCESS,閉環'],
], [22, 78]));

const doc = new Document({ creator: 'VCF Lab', title: 'HCX 9.1.1 Stale Mesh Recovery',
  styles: { default: { document: { run: { font: '微軟正黑體', size: 21 } } } },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }, { level: 1, format: LevelFormat.BULLET, text: '\u2013', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 980, hanging: 300 } } } }] },
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] } ] },
  sections: [{ properties: {}, children: ch }] });
Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log('wrote', OUT, b.length); });
