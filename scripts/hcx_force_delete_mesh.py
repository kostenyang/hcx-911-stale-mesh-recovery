#!/usr/bin/env python3
"""在 HCX Manager 本機(admin SSH)執行:列出 service mesh / appliance,必要時 force-delete 殘留 mesh。
  python3 hcx_force_delete_mesh.py --user 'svc_hcx@ESB.LOCAL'                                 # 只列出
  python3 hcx_force_delete_mesh.py --user 'svc_hcx@ESB.LOCAL' --delete --mesh-id servicemesh-xxxx           # 強制刪(force=true,預設)
  … --delete --mesh-id servicemesh-xxxx --yes                                                      # 不問 YES
  … --delete --mesh-id servicemesh-xxxx --no-force                                                 # 一般刪除(force=false)
要在「發起 mesh 的那一站」跑(isInitiator=true 那邊,玉山測試對 = hcxt)。"""
import argparse, getpass, json, sys, time, urllib3, requests
urllib3.disable_warnings()
p = argparse.ArgumentParser(); p.add_argument('--host', default='https://localhost'); p.add_argument('--user', required=True)
p.add_argument('--mesh-id'); p.add_argument('--delete', action='store_true'); p.add_argument('--yes', action='store_true', help='skip the YES confirmation'); p.add_argument('--no-force', action='store_true', help='normal delete (force=false)'); a = p.parse_args()
pw = getpass.getpass(f'Password for {a.user}: ')
s = requests.Session(); s.verify = False
r = s.post(f'{a.host}/hybridity/api/sessions', json={'username': a.user, 'password': pw}, headers={'Accept': 'application/json'})
tok = r.headers.get('x-hm-authorization')
if not tok: sys.exit(f'login failed: {r.status_code} {r.text[:300]}')
h = {'x-hm-authorization': tok, 'Accept': 'application/json'}
def get(path): return s.get(f'{a.host}{path}', headers=h).json()
print('\n=== service meshes ===')
meshes = get('/hybridity/api/interconnect/serviceMesh').get('items', [])
for m in meshes:
    lt = m.get('lastTaskDetails') or {}
    cps = ','.join(f"{c.get('endpointName')}{'(init)' if c.get('isInitiator') else ''}" for c in m.get('computeProfiles', []))
    print(f"{m['serviceMeshId']:52} {m.get('name','')[:32]:32} state={m.get('state')} lastTask={lt.get('type')}/{lt.get('status')} backing={m.get('backingApplianceType')} updateAvailable={m.get('updateAvailable')}\n    computeProfiles: {cps}")
print('\n=== appliances ===')
apps = get('/hybridity/api/interconnect/appliances').get('items', [])
for x in apps:
    st = (x.get('status') or {}).get('summary', {})
    print(f"{x.get('applianceId'):40} {x.get('applianceName','')[:36]:36} {x.get('applianceType','')[:12]:12} mesh={x.get('serviceMeshId')} status={st.get('overallStatus')} version={x.get('version') or x.get('applianceVersion')}")
if not a.delete:
    print('\n(只列出。要刪:--delete --mesh-id <id>)'); sys.exit(0)
if not a.mesh_id: sys.exit('--delete 需要 --mesh-id')
target = next((m for m in meshes if m['serviceMeshId'] == a.mesh_id), None)
if target and (target.get('name','').startswith('default-service-mesh') or target.get('backingApplianceType') == 'NOT_APPLICABLE'):
    sys.exit('這是系統自動建的 self-site mesh(HCX Assisted vMotion),不要刪')
print(f'\n!!! 即將 FORCE DELETE {a.mesh_id} on {a.host}'); 
if input('type YES: ') != 'YES': sys.exit(0)
d = s.delete(f'{a.host}/hybridity/api/interconnect/serviceMesh/{a.mesh_id}', params={'force': 'true'}, headers=h)
print(d.status_code, d.text[:800])
try: tid = d.json()['data']['interconnectTaskId']
except Exception: tid = None
while tid:
    time.sleep(10); t = get(f'/hybridity/api/interconnect/tasks/{tid}')
    print(f"{t.get('status')} {t.get('progress')}% {t.get('message')}")
    if t.get('status') not in ('RUNNING', 'QUEUED'): break
print('\n=== after ===')
for m in get('/hybridity/api/interconnect/serviceMesh').get('items', []): print(m['serviceMeshId'], m.get('name'), m.get('state'))
print('appliances left:', len(get('/hybridity/api/interconnect/appliances').get('items', [])))
