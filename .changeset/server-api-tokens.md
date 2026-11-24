---
---

Server only (no npm release): administrators issue API tokens (`shmk_…`, Settings → API Tokens or `/api/admin/api-tokens`) with a role and an expiry, and automation such as Terraform sends them as `Authorization: Bearer`. Only a hash of each token is stored; tokens also work in proxy-auth (SSO) mode.
