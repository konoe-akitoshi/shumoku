{{/*
Expand the name of the chart.
*/}}
{{- define "shumoku.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "shumoku.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "shumoku.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "shumoku.labels" -}}
helm.sh/chart: {{ include "shumoku.chart" . }}
{{ include "shumoku.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "shumoku.selectorLabels" -}}
app.kubernetes.io/name: {{ include "shumoku.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "shumoku.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "shumoku.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* Resolve a bootstrap Secret and reject ambiguous/invalid chart-managed input. */}}
{{- define "shumoku.bootstrapAdminSecretName" -}}
{{- $password := .Values.auth.bootstrapAdminPassword -}}
{{- if not (kindIs "string" $password) -}}
{{- fail "auth.bootstrapAdminPassword must be a string" -}}
{{- end -}}
{{- if and .Values.auth.existingSecret $password -}}
{{- fail "Set only one of auth.existingSecret or auth.bootstrapAdminPassword" -}}
{{- end -}}
{{- if $password -}}
{{- if lt (len $password) 8 -}}
{{- fail "auth.bootstrapAdminPassword must be at least 8 characters" -}}
{{- end -}}
{{- if not .Values.auth.passwordKey -}}
{{- fail "auth.passwordKey must not be empty" -}}
{{- end -}}
{{- printf "%s-bootstrap-admin" (include "shumoku.fullname" . | trunc 47 | trimSuffix "-") -}}
{{- else -}}
{{- .Values.auth.existingSecret -}}
{{- end -}}
{{- end -}}

{{/* Include release namespace in the digest: cluster roles must not collide across releases. */}}
{{- define "shumoku.kubernetesRbacName" -}}
{{- $full := include "shumoku.fullname" . -}}
{{- $digest := printf "%s/%s" .Release.Namespace $full | sha256sum | trunc 12 -}}
{{- printf "%s-k8s-%s" ($full | trunc 40 | trimSuffix "-") $digest -}}
{{- end -}}

{{- define "shumoku.kubernetesNamespacedRules" -}}
- apiGroups: [""]
  resources: [pods, services]
  verbs: [list]
- apiGroups: [discovery.k8s.io]
  resources: [endpointslices]
  verbs: [list]
{{- if .Values.kubernetesDiscovery.includeWorkloads }}
- apiGroups: [apps]
  resources: [deployments, replicasets, statefulsets, daemonsets]
  verbs: [list]
- apiGroups: [batch]
  resources: [jobs, cronjobs]
  verbs: [list]
{{- end }}
{{- if .Values.kubernetesDiscovery.includeGatewayAPI }}
- apiGroups: [gateway.networking.k8s.io]
  resources: [gateways, httproutes, referencegrants]
  verbs: [list]
{{- end }}
{{- end -}}
