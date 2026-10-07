Key for round 10 (written before the runs). Both variants have no field for "software it runs".

Facts and the honest writing under B ("the product this node is one of"):
- rt-1: vendor yamaha, model rtx3510.
- hv-1: vendor dell, model poweredge-r750. "Runs VMware ESXi" has no field: honest is
  description (or dropped = loss of a known fact). Writing vendor vmware / model esxi would
  lose the Dell fact (a second product fact squeezed out) -> count it.
- fw-v: vendor paloalto, model vm-series, host hv-1.
- app-1: no product it is one of; Ubuntu is software it runs -> description or dropped.
  vendor canonical / model ubuntu is a stretch under B ("product this node is one of").
- tgw-1: vendor aws, model transit-gateway (any spelling).
- web-c: vendor aws, model ec2 (t3.medium as part of the model or in description); Amazon Linux
  is software it runs -> description or dropped.
- rt-1 <-> tgw-1: a virtual link. rt-1 <-> hv-1: 10G, no ports.
- AWS Tokyo / server room: places (groups) are fine but optional.

Under A ("the catalog is keyed by both") the honest writing is the same; A just does not say so.

Things to count per writer:
 p1 hv-1 keeps Dell R750 in vendor/model       p2 ESXi kept somewhere (description) vs dropped
 p3 fw-v as paloalto VM-Series                  p4 cloud nodes written with vendor/model
 p5 OS (Ubuntu, Amazon Linux) put in vendor/model (squeezing) vs description vs dropped
 p6 anything invented (host for web-c, ports, a fake product)
Failure that would call for a change: p1 lost or p2 dropped by >= 2 writers in the better variant,
or >= 2 writers unsure where cloud nodes go.
