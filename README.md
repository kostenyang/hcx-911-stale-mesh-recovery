# HCX 9.1.1 — stale Service Mesh recovery (IX appliance lost after Manager upgrade)

Root-cause analysis, lab reproduction and on-site recovery procedure for **VCF Operations HCX 9.1.1**:

* **Problem A** – after upgrading HCX Manager to 9.1.1, `ThumbprintExchanger` fails every 15 min with
  `Host name '<IX IP>' does not match the certificate subject provided by the peer (CN=VMware vSphere Replication Server)`.
  9.1.1 Manager verifies the IX HBR (port 8123) certificate hostname strictly; legacy IX certs have no IP SAN.
  9.1.1 (EDGE) appliances carry an IP SAN **and** their cert is stored in the Manager's trusted-certificate bucket, so they pass.
  Bypass (verified): the verifier skips hostname checking when the peer leaf cert is in *Trusted Certificates* (9443).
* **Problem B** – IX VM gone, `resyncServiceMesh` stuck, mesh `lastTaskDetails` never updated → UI "Loading service mesh list…" forever.
  Fix (verified end-to-end in lab): `DELETE /hybridity/api/interconnect/serviceMesh/{id}?force=true` from the **initiator** site,
  then rebuild the mesh (9.1.1 always builds EDGE appliances).

## Layout
| path | what |
|---|---|
| `HCX911-StaleMesh-Recovery-Report.docx` | internal technical report (zh-TW) |
| `docs/analysis-and-lab-log.md` | full working notes: log excerpts, decompiled code paths, API recipes, lab timeline |
| `docs/lab-hcx-deploy.md` | HCX Unified Appliance lab deployment notes |
| `scripts/hcx_force_delete_mesh.py` | **on-site tool** – run as `admin` on the HCX Manager (python3 + requests are built in) |
| `scripts/Remove-StaleServiceMesh.ps1` | same, PowerShell (jump host) |
| `scripts/hcx-mesh-after-nsx.sh` | lab: register NSX → site pairing → create mesh |
| `scripts/deploy-hcx0*.sh` | lab: ovftool deployment of the appliance |
| `docs/gen-hcx911-stale-mesh-doc.js` | docx generator (docx-js) |

## On-site quick path
```bash
# on the initiator HCX Manager, as admin
python3 hcx_force_delete_mesh.py --user 'svc_hcx@DOMAIN'                       # list
python3 hcx_force_delete_mesh.py --user 'svc_hcx@DOMAIN' --delete --mesh-id servicemesh-xxxx   # force delete
```
Never delete `default-service-mesh-*` (system self-site mesh for HCX Assisted vMotion) — the script refuses.

Passwords in lab scripts are replaced by placeholders.
