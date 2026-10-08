Key for round 21 (written before the runs). Re-check after choosing the operator view (option 1).
Model: r11/types-r21.ts (= model.ts now). Task task-r21.md: task-r18 with each IX address given
under the router that holds it.
Writers (luna x5, sol x1) on task-r21: k1 parse ok; k2 each IX address under its router;
k3 AS290 written as a routing domain (expected about 0, as in round 16); k4 dual stack as a
prefix list; k5 inventions (optical paths, addresses on a provider's switch, ASNs not given).
Readers (luna x5, sol x1) on read-r21.yaml, questions-r21.md, key-read-r21.md.
Regression: writers (luna x5) on task-r10-7 (VRF and VPC) and task-r10-2 (VPC): parse ok, VPC and
guest VRF kept as routing domains, no AS-like inventions.
Prediction: k1 5/6 or more, k2 6/6, k3 0-1, k4 6/6; readers 11/12 or more each; no regression.

Results.
Writers on task-r21 (operator view): parse ok first time 2/6 (sol and one luna); the rest were
links with 3 or 1 ends, a node end for a segment, and similar. Fed the error back, all 6 passed
within 4 rounds. IX addresses under the given router: 6/6. Dual stack as a prefix list: 6/6.
AS290 written as a routing domain: luna 5/5, sol 0/1 — the prediction (0-1) was wrong: with the
addresses given per router the pull stayed ("treating it as the routers' shared routing domain").
The sentence in the routing domain's comment does not reach luna. Taken: the parser rejects a
routing domain named like an AS (as290, AS 64500) and says to write asn on the nodes; fed that
error, 5/5 moved to asn 290 on the three routers in one round.
The endpoint-count error now says to write one link per pair or a segment; the last stuck writer
passed with it.
Readers (read-r21.yaml): luna 5: Q1 2/5, Q6 0/5, Q7 0/5, Q12 3/5, the rest 4-5/5; sol 11/12 (Q6).
Q1 (asn 290 read as "cannot tell") was 3/3 right when asked alone; not explained. Q6 (is the
name known, no label) and Q7 (confirmed, no assumed): readers answer "cannot tell" from an absent
field; the question sheet's "if the YAML does not say, answer cannot tell" invites that, and the
model never says a writer must write a known name, so Q6 "cannot tell" is defensible and the key
over-asked. Q7 is stated (assumed absent = confirmed) and only sol read it.
Regression: VRF/VPC task-r10-7 4/5 parse, task-r10-2 2/5; all passed within one fed-back error.
One wrote routingDomain on a node because the routing domain's comment said nodes belong to it;
the comment now says segments belong to it.
