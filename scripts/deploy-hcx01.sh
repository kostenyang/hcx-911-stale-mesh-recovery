#!/usr/bin/env bash
# Deploy HCX Unified Appliance (VCF Operations HCX 9.1.1) to outer vCenter 10.0.0.101
export MSYS_NO_PATHCONV=1
OVF="/c/Program Files/VMware/VMware OVF Tool/ovftool.exe"
OVA='E:\9.1\hcx-unified-appliance-9.1.1.0.25690219.ova'
PW='<HCX_ADMIN_PW>'
TARGET='vi://administrator%40vsphere.local:<VC_PW_URLENC>@10.0.0.101/Datacenter/host/Cluster/10.0.0.95'

"$OVF" \
  --acceptAllEulas --noSSLVerify --allowExtraConfig --X:injectOvfEnv --X:waitForIp \
  --name=hcx01 \
  --datastore=vmfs-samsung4t \
  --diskMode=thin \
  --net:"VSMgmt=MGMT" \
  --prop:hostname=hcx01.home.lab \
  --prop:mgr_ip_0=10.0.0.86 \
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
