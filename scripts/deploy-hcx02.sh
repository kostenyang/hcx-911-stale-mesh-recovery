#!/usr/bin/env bash
# 第二個 HCX site — VCF Operations HCX 9.1.1 → vcf-m02-hcx / 10.0.1.26
#
# 🔴 執行前提:M02 管理域要已重建完成(vcf-m02-vc01 10.0.1.19 起來)。
#    appliance 本身部在「外層」vCenter(跟 hcx01 與舊的 vcf-m01-hcx 同模式),
#    IP 掛在同一個 10.0.0.0/23,之後在 9443 註冊到 nested lab vCenter。
#
# DNS 已存在(不必再建):vcf-m02-hcx.home.lab A 10.0.1.26 + PTR 皆已驗證。
export MSYS_NO_PATHCONV=1
OVF="/c/Program Files/VMware/VMware OVF Tool/ovftool.exe"
OVA='E:\9.1\hcx-unified-appliance-9.1.1.0.25690219.ova'
PW='<HCX_ADMIN_PW>'
TARGET='vi://administrator%40vsphere.local:<VC_PW_URLENC>@10.0.0.101/Datacenter/host/Cluster/10.0.0.95'

"$OVF" \
  --acceptAllEulas --noSSLVerify --allowExtraConfig --X:injectOvfEnv --X:waitForIp \
  --name=vcf-m02-hcx \
  --vmFolder=VCF \
  --datastore=vmfs-samsung4t \
  --diskMode=thin \
  --net:"VSMgmt=MGMT" \
  --prop:hostname=vcf-m02-hcx.home.lab \
  --prop:mgr_ip_0=10.0.1.26 \
  --prop:mgr_prefix_ip_0=23 \
  --prop:mgr_gateway_0=10.0.0.1 \
  --prop:mgr_dns_list=10.0.0.200 \
  --prop:mgr_domain_search_list=home.lab \
  --prop:mgr_ntp_list=10.0.1.254 \
  --prop:mgr_isSSHEnabled=True \
  --prop:mgr_cli_passwd="$PW" \
  --prop:mgr_root_passwd="$PW" \
  --prop:mgr_grub_passwd="$PW" \
  --powerOn \
  "$OVA" "$TARGET"
echo "ovftool exit=$?"
# 之後:等約 400 秒 https://10.0.1.26:9443 從 503 轉 302,再用 admin 登入註冊 vcf-m02-vc01。
