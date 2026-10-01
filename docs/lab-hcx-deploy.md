# HCX Unified Appliance 部署紀錄 — hcx01

部署日期:2026-09-30

## 成品

| 項目 | 值 |
|---|---|
| OVA | `E:\9.1\hcx-unified-appliance-9.1.1.0.25690219.ova`(VCF Operations HCX 9.1.1 build 25690219) |
| VM 名稱 | `hcx01` |
| 規格 | 4 vCPU / 12 GB RAM / 64 GB thin |
| FQDN / IP | hcx01.home.lab / 10.0.0.86 (prefix 23) |
| Gateway | **10.0.0.1**(不是 10.0.0.254 — 外層 MGMT 網段的預設閘道) |
| DNS / search | 10.0.0.200 / home.lab(A + PTR 已建並驗證) |
| NTP | 10.0.1.254(RouterOS) |
| vCenter | 外層 10.0.0.101 `/Datacenter/host/Cluster/10.0.0.95` |
| Datastore | `vmfs-samsung4t`(host 10.0.0.95 本機,2.7 TB free) |
| Portgroup | `MGMT`(dvportgroup-443,= vcf9depot2 在用的那個) |
| 密碼 | admin / root / GRUB 皆 lab 標準;SSH 已開啟 |
| 管理 UI | https://hcx01.home.lab:9443 (admin) |
| HCX UI | https://hcx01.home.lab/ (啟用後) |

## 部署方式

`E:\9.1\deploy-hcx01.sh`(ovftool),log `dev-docs/_hcx01-deploy.log`。
關鍵旗標:`--allowExtraConfig`(OVA 帶 hybridity.* ExtraConfig)、`--X:injectOvfEnv`、`--X:waitForIp`。
OVF 屬性 key 無 vami 前綴,直接 `--prop:mgr_ip_0=` 等即可。

## 環境前提(部署當下)

- nested VCF M02 **整套關機**(esx01-04 poweredOff、10.0.1.19 不通),因此本機只接外層 vCenter。
- 外層到 `connect.hcx.vmware.com` 可通(HTTP 301),線上啟用可行。

## 待辦

- [ ] **HCX activation key**:`.broadcom-activation-code` 那把是 depot 用的,不是 HCX key。需從 Broadcom portal 取。
- [ ] 啟用後在 9443 做 vCenter / SSO 註冊(vCenter 10.0.0.101、SSO lookup service)。
- [ ] 若要做 site pairing 到 VCF 9.1.1:先開 nested lab,再部第二台 HCX 接 vcf-m02-vc01。

## 部署後驗證(2026-09-30 實測)

| 檢查 | 結果 |
|---|---|
| ovftool | exit 0,`Received IP address: 10.0.0.86` |
| VM | `hcx01` poweredOn @ host 10.0.0.95;`hybridity.vmtype=Manager` / `vmversion=9.1.1.0` |
| IP / prefix / gw | `10.0.0.86/23`、`default via 10.0.0.1` ✅ |
| hostname | `hcx01.home.lab` ✅ |
| DNS | `Current DNS Server: 10.0.0.200`、`DNS Domain: home.lab` ✅ |
| NTP | `ntpq -pn` → `*10.0.1.254` refid 216.239.35.4,offset 4.4 ms ✅ |
| Appliance Mgmt UI | https://10.0.0.86:9443 → 302(登入頁);初始化期間會回 **503 約 400 秒** |
| admin 認證 | ✅ 正確密碼 200 / 錯誤密碼 403(`/api/admin/global/config/vcenter`) |
| vCenter 註冊 | 尚未(`{"data":{"items":[]}}`,要先啟用) |
| SSH | 已開啟,`admin@10.0.0.86` 可登入 |

### 坑

- **gateway 是 10.0.0.1,不是 10.0.0.254**。外層 MGMT 網段查本機路由表才確定。
- **`timedatectl` 會說 `System clock synchronized: no`,那是誤判** —— 它看的是 systemd-timesyncd(inactive),
  HCX 實際跑的是 **ntpd**,`ntpq -pn` 才是真相(已 `*` 同步)。
- **HCX 的時間比本機 10.0.0.200 慢約 176 秒是正常的** —— 慢的不是 HCX,是 AD 那台快(與既有筆記一致)。
  HCX 對的是 RouterOS 10.0.1.254。
- plink 第一次連要 `-hostkey SHA256:2y8A4WDo4mfDJMgTWW7lR84TPgSt4aLcLi1RmfSZSxM`(batch 模式不會自動接受)。

## 第二個 site(待 M02 重建完成)

**2026-09-30 查到的環境真相**(跟 `CONTEXT-vcf91-lab.md` 已不符,那份停在 08-25):

- **M02 管理域不存在**,不是關機。外層 vCenter 10.0.0.101 裡沒有任何 M02 的 nested ESXi VM;
  `esx01~04` 是 `.vmtx` 樣板且檔案在已死的 `vsanDatastore`(0 GB,9/2 disconnected);
  10 個 datastore 全掃過都沒有 m02 host 檔案;10.0.1.0/24 ping sweep 只剩
  `.3` CloudBuilder(vcf-m01-cb01-conv)、`.4`/`.44` 兩台 VCF Installer 9.1.1、`.253`、`.254`。
- 今天 08:48 `inst05-deploy.log` 有 SDDC Manager 9.1.1 OVA 上傳 → **M02 正在重建中**。
- 現存唯一一組 nested ESXi = `vcf-m01-esx01~04-vcd`(12 vCPU/64 GB,ForNFS),
  2026-09-22 17:21 guest shutdown 後關著 = DNS 的 `vcf-m01-esx01~04`(10.0.1.10-13),
  其 vCenter 是 `vcf-m01-vc01` 10.0.1.9。
- 既有 **`vcf-m01-hcx`**:HCX **9.0.1.0**、10.0.1.25/23、gw 10.0.0.1、NTP 10.0.1.254、
  portgroup MGMT、datastore samsung4t,**關機中**。
  → 證實本 lab 的 HCX 模式 = **appliance 放外層 vCenter,IP 掛在同一個 /23,再註冊到 nested vCenter**。

**決定(使用者)**:等 M02 重建完再接第二個 site;第二台用**新部的 9.1.1**(不沿用 9.0.1 那台)。

**已備好**:`E:\9.1\deploy-hcx02.sh` —— `vcf-m02-hcx` / **10.0.1.26**(DNS A+PTR **已存在**且 IP 未被使用),
其餘參數與 hcx01 相同。M02 的 vCenter 起來後直接跑,再到 9443 註冊 `vcf-m02-vc01` 10.0.1.19。

### 更正(同日 09:5x):M02 不是不存在,是正在被另一個 session 重建

上面那段「M02 管理域不存在」是**掃描時間點造成的誤判**。使用者指出狀態在
session「VCF 5.2.1 VSAN 叢集測試」(`local_54df1138-a612-4c42-be5f-a5c1d9eebdad`),
它當時正在重建 M02;我 09:00 掃的時候 nested ESXi 還沒部出來。

重掃結果(09:5x):

| 項目 | 值 |
|---|---|
| nested ESXi | `vcf-m02-esx01-91`~`esx04-91`,24 vCPU / **192 GB**,resource pool `Nested-VCF9-M02-qJvClhGz`,跑在外層 host 10.0.0.95 |
| IP | 10.0.1.14-17 ✅ 都 ping 得到 |
| vCenter | 10.0.1.19 = **vCenter 9.1.1.0.25712839**,UI 200 |
| inventory | ⚠️ **全空** —— 無 datacenter / cluster / host / datastore(剛跑完 firstboot) |
| host 10.0.0.95 | 1 TB RAM 用 9.6%、samsung4t 還有 2393 GB —— 資源充裕 |

該 session 後續:`Build-ConvergeTarget.ps1`(加 esx02-04 進 `vcf-m02-cl01`、VDS MTU 9000、
vMotion 192.168.23.x / vSAN 192.168.24.x、disk group、DRS+HA)→ ESXi 升 9.1.1 → converge,
並要清查殘留的 `com.vmware.sddcManager` / `com.vmware.vcf.client` extension。

🔴 **HCX 暫不註冊進 10.0.1.19**:現在沒 cluster/datastore 註冊不了,且 HCX 會寫自己的 vCenter extension,
會跟那邊的 extension 清查與 converge 打架。appliance 本身部在外層不影響它,但註冊要等。
