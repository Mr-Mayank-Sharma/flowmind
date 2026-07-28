# FlowMind Kubernetes Deployment

## Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- Docker images built and available (or use local registry)

## Quick Start

```bash
# Apply all manifests
kubectl apply -f infra/k8s/

# Or apply in order
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/redis.yaml
kubectl apply -f infra/k8s/qdrant.yaml
kubectl apply -f infra/k8s/api.yaml
kubectl apply -f infra/k8s/web.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

## Build Images

```bash
# From project root
docker build --target api -t flowmind/api:latest .
docker build --target web-runner -t flowmind/web:latest .
```

## Access

```bash
# Port-forward for local access
kubectl port-forward -n flowmind svc/flowmind-web 3000:3000
kubectl port-forward -n flowmind svc/flowmind-api 3001:3001
```

## Configuration

Edit `configmap.yaml` for non-sensitive settings and `secrets.yaml` for secrets.
For production, use external secret management (e.g., AWS Secrets Manager, Vault).

## Teardown

```bash
kubectl delete namespace flowmind
```
