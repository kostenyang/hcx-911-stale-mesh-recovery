#!/usr/bin/env bash
# 等 M02 converge(變體 A)把 vcf-m02-nsx01a 部出來後,一鍵接完 HCX 測試鏈:
#   1) hcx02 註冊 NSX  2) hcx01 -> hcx02 site pairing  3) 建 service mesh (IX 9.1.1)  4) 盯 ThumbprintExchanger
# 用法: bash hcx-mesh-after-nsx.sh https://vcf-m02-nsx01a.home.lab admin 'NSX密碼'
set -u
NSX_URL="${1:-https://vcf-m02-nsx01a.home.lab}"; NSX_USER="${2:-admin}"; NSX_PW="${3:?nsx password}"
H1=10.0.0.86; H2=10.0.1.26; PW1='<VC_PW>'; PW2='<HCX_ADMIN_PW>'; ADM='admin:<HCX_ADMIN_PW>'
tok(){ curl -sk -m 30 -D- -o /dev/null -H 'Content-Type: application/json' -d "{\"username\":\"administrator@vsphere.local\",\"password\":\"$2\"}" https://$1/hybridity/api/sessions | grep -i '^x-hm-authorization:' | sed 's/^[^:]*: *//' | tr -d '\r\n'; }
# ---- 1) NSX 註冊到 hcx02(9443;密碼 base64;憑證先匯) ----
B64=$(printf '%s' "$NSX_PW" | base64 | tr -d '\n')
body="{\"data\":{\"items\":[{\"config\":{\"url\":\"$NSX_URL\",\"userName\":\"$NSX_USER\",\"password\":\"$B64\"},\"section\":\"nsx\"}]}}"
R=$(curl -sk -m 120 -u "$ADM" -H 'Content-Type: application/json' -X POST -d "$body" https://$H2:9443/api/admin/global/config/nsx)
if echo "$R" | grep -q 'Untrusted SSL'; then C=$(echo "$R" | python -c "import sys,json;print(json.load(sys.stdin)['data'][0]['certificate'])"); python -c "import json,sys;print(json.dumps({'certificate':sys.argv[1]}))" "$C" > /tmp/nsxcert.json; curl -sk -m 60 -u "$ADM" -H 'Content-Type: application/json' -X POST --data-binary @/tmp/nsxcert.json https://$H2:9443/api/admin/certificates >/dev/null; R=$(curl -sk -m 180 -u "$ADM" -H 'Content-Type: application/json' -X POST -d "$body" https://$H2:9443/api/admin/global/config/nsx); fi
echo "NSX register: $(echo "$R" | head -c 300)"; echo
curl -sk -m 60 -u "$ADM" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"toggleComponentStatus","id":"1","params":["APPENGINE","RESTART"]}' https://$H2:9443/api/1.0/appliance-management/jsonrpc/components >/dev/null; echo "hcx02 appengine restarting..."; sleep 60
until [ "$(curl -sk -m 8 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d "{\"username\":\"administrator@vsphere.local\",\"password\":\"$PW2\"}" https://$H2/hybridity/api/sessions)" = "200" ]; do sleep 15; done
# ---- 2) site pairing hcx01 -> hcx02(hcx02 憑證已在 hcx01 信任清單) ----
T1=$(tok $H1 "$PW1"); H=(-H "x-hm-authorization: $T1" -H 'Accept: application/json' -H 'Content-Type: application/json')
curl -sk -m 600 "${H[@]}" -d "{\"remote\":{\"url\":\"https://vcf-m02-hcx.home.lab\",\"username\":\"administrator@vsphere.local\",\"password\":\"$PW2\"}}" https://$H1/hybridity/api/cloudConfigs | head -c 800; echo
# ---- 3) service mesh(INTERCONNECT only,跟客戶一樣) ----
EP2=20260930095531162-de434b28-af6e-4d65-9026-b064bc6ac023; EP1=20260930084308660-71f463c6-b1fd-46d6-aefa-cc33bd9ec56b
CP1=fad929b6-1f16-4b4e-9c4d-84b3dc2f9ac0; CP2=73e60e21-83ea-454b-bcd0-f0b7196eec5f
NP1=network-e797cf9a-9782-4229-8538-0771b4e371e5; NP2=network-d2c47368-5771-4c3d-9384-b06c88213bf0
cat > /tmp/sm.json <<J
{"name":"outer-to-m02","services":[{"name":"INTERCONNECT"}],
 "computeProfiles":[
  {"endpointId":"$EP1","computeProfileId":"$CP1","isInitiator":true,"overriddenUplink":true,"networks":[{"id":"$NP1","tags":["uplink"]}]},
  {"endpointId":"$EP2","computeProfileId":"$CP2","isInitiator":false,"overriddenUplink":true,"networks":[{"id":"$NP2","tags":["uplink"]}]}],
 "trafficEnggCfg":{"isAppPathResiliencyEnabled":false,"isTcpFlowConditioningEnabled":false,"isEncryptionlessTunnelEnabledForMigration":false,"isEncryptionlessTunnelEnabledForNE":false,"groEnabled":false}}
J
T1=$(tok $H1 "$PW1"); H=(-H "x-hm-authorization: $T1" -H 'Accept: application/json' -H 'Content-Type: application/json')
echo "mesh preview:"; curl -sk -m 300 "${H[@]}" --data-binary @/tmp/sm.json https://$H1/hybridity/api/interconnect/serviceMesh/preview 2>/dev/null | head -c 400; echo
echo "mesh create:";  curl -sk -m 300 "${H[@]}" --data-binary @/tmp/sm.json https://$H1/hybridity/api/interconnect/serviceMesh | head -c 600; echo
echo "之後:等 IX 部好(GET /hybridity/api/interconnect/appliances),再到兩台 manager 看 /common/logs/admin/app.log 有無 'ThumbprintExchanger' / 'does not match the certificate subject'"
