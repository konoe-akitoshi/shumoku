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
