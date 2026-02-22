# 🔐 Configuración de Repositorio Dual - BYD Stats

**Objetivo**: Proteger el código premium de `pybyd-integration` mientras mantienes sincronización con la PWA pública.

## 📊 Estrategia: Dual Repo con Remote Múltiple

### **Estructura Final**

```
📦 BYD-Stats-Premium (Repo Privado - Tu workspace principal)
  ├── main                 → Sincronizado con público
  └── feat/pybyd-integration → Solo privado, código premium

📦 BYD-Stats (Repo Público - Solo lectura para comunidad)
  └── main                 → PWA open-source
```

### **✅ Ventajas**
- ✅ Código premium 100% privado
- ✅ Trabajas en UN SOLO lugar (repo privado)
- ✅ Sincronización selectiva al público
- ✅ Historial limpio en ambos repos
- ✅ Compartes mejoras fácilmente con cherry-pick

---

## 🚀 Pasos de Implementación

### **Paso 1: Crear Repositorio Privado**

1. Ve a https://github.com/new
2. Configuración:
   - **Nombre**: `BYD-Stats-Premium` (o el que prefieras)
   - **Visibilidad**: ⚠️ **PRIVATE** (muy importante)
   - **NO** inicialices con README, .gitignore ni license
3. Crear repositorio
4. **Copia la URL**: `https://github.com/TU_USUARIO/BYD-Stats-Premium.git`

### **Paso 2: Configurar Remotes en tu Repo Local**

```bash
cd /c/Users/migue/Github/BYD-Stats/byd-stats

# 1. Renombrar el remote actual a 'public'
git remote rename origin public

# 2. Añadir el nuevo remote privado como 'origin'
git remote add origin https://github.com/TU_USUARIO/BYD-Stats-Premium.git

# 3. Verificar configuración
git remote -v
# Deberías ver:
# origin    https://github.com/TU_USUARIO/BYD-Stats-Premium.git (fetch)
# origin    https://github.com/TU_USUARIO/BYD-Stats-Premium.git (push)
# public    https://github.com/TU_USUARIO/BYD-Stats.git (fetch)
# public    https://github.com/TU_USUARIO/BYD-Stats.git (push)
```

### **Paso 3: Push Inicial al Repo Privado**

```bash
# Push TODAS las branches al repo privado
git push -u origin --all

# Push todos los tags también
git push origin --tags

# Verificar que se subió todo
git branch -r
# Deberías ver tanto origin/... como public/...
```

### **Paso 4: Eliminar Branch Privada del Repo Público**

```bash
# Eliminar la branch feat/pybyd-integration del público
git push public :feat/pybyd-integration

# Verificar eliminación
# Ve a https://github.com/TU_USUARIO/BYD-Stats/branches
# y confirma que feat/pybyd-integration ya NO existe
```

### **Paso 5: Configurar Branch Protection en GitHub**

#### **En el Repo Privado (BYD-Stats-Premium):**
1. Ve a Settings → Branches → Add rule
2. Branch name pattern: `feat/pybyd-integration`
3. Configuración:
   - ✅ Require pull request reviews (opcional)
   - ✅ Include administrators

#### **En el Repo Público (BYD-Stats):**
1. Ve a Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Configuración:
   - ✅ Require pull request reviews
   - ✅ Restrict who can push

### **Paso 6: Configurar Aliases de Git**

```bash
# Alias para ver estado de ambos repos
git config alias.status-all '!git fetch --all && echo "=== ORIGIN (PRIVADO) ===" && git log origin/$(git branch --show-current)..HEAD --oneline && echo "" && echo "=== PUBLIC ===" && git log public/$(git branch --show-current)..HEAD --oneline'

# Alias para sincronizar main de forma segura
git config alias.sync-main '!git checkout main && git pull origin main && git push public main'

# Alias para usar el script de push seguro
git config alias.push-safe '!bash push-safe.sh'
```

---

## 📝 Workflow Diario

### **Escenario 1: Mejoras Compartidas (PWA + APK Premium)**

```bash
# 1. Trabaja en branch main o crea feature branch
git checkout main
# ... haces cambios compartidos ...
git add .
git commit -m "feat: nueva funcionalidad compartida"

# 2. Push a AMBOS repos
git push origin main      # Privado (Premium)
git push public main      # Público (PWA)
```

### **Escenario 2: Código Premium (solo APK)**

```bash
# 1. Trabaja en branch feat/pybyd-integration
git checkout feat/pybyd-integration
# ... haces cambios premium (integración PyBYD, etc.) ...
git add .
git commit -m "feat: integración PyBYD premium"

# 2. Push SOLO al privado
git push origin feat/pybyd-integration

# ⚠️ NUNCA: git push public feat/pybyd-integration
```

### **Escenario 3: Llevar Mejora de Main a Premium**

```bash
# Si hiciste una mejora en main que también necesitas en premium
git checkout feat/pybyd-integration
git merge main

# O si prefieres cherry-pick selectivo:
git cherry-pick <commit-hash>

git push origin feat/pybyd-integration
```

### **Escenario 4: Usar Script de Push Seguro**

```bash
# El script detecta automáticamente si es branch privada o pública
bash push-safe.sh

# O usando el alias:
git push-safe
```

---

## 🛡️ Script de Seguridad: `push-safe.sh`

**Ubicación**: `/c/Users/migue/Github/BYD-Stats/byd-stats/push-safe.sh`

**Funcionalidad**:
- Detecta si estás en una branch privada o pública
- **Branch privada**: Solo pushea a `origin` (privado)
- **Branch pública**: Pushea a `origin` y pregunta si también quieres pushear a `public`
- Previene pushes accidentales de código premium al repo público

**Uso**:
```bash
bash push-safe.sh
# o
git push-safe
```

---

## 📊 Tabla de Referencia Rápida

| Escenario | Comandos | Remotes |
|-----------|----------|---------|
| **Mejora compartida (PWA + APK)** | `git checkout main`<br>`git add .`<br>`git commit -m "feat: ..."`<br>`git push origin main`<br>`git push public main` | `origin` + `public` |
| **Código premium (solo APK)** | `git checkout feat/pybyd-integration`<br>`git add .`<br>`git commit -m "feat: ..."`<br>`git push origin feat/pybyd-integration` | Solo `origin` |
| **Sincronizar main → premium** | `git checkout feat/pybyd-integration`<br>`git merge main`<br>`git push origin feat/pybyd-integration` | Solo `origin` |
| **Push seguro** | `bash push-safe.sh` | Automático |

---

## 🔍 Verificación y Troubleshooting

### **Verificar Configuración de Remotes**

```bash
git remote -v

# Salida esperada:
# origin    https://github.com/TU_USUARIO/BYD-Stats-Premium.git (fetch)
# origin    https://github.com/TU_USUARIO/BYD-Stats-Premium.git (push)
# public    https://github.com/TU_USUARIO/BYD-Stats.git (fetch)
# public    https://github.com/TU_USUARIO/BYD-Stats.git (push)
```

### **Verificar Branches en Ambos Repos**

```bash
git branch -r

# Deberías ver:
# origin/main
# origin/feat/pybyd-integration
# public/main
# (NO deberías ver public/feat/pybyd-integration)
```

### **Ver Estado de Sincronización**

```bash
git status-all
# Muestra commits pendientes en cada remote
```

### **Problemas Comunes**

#### **Error: "remote origin already exists"**
```bash
# Solución: Elimina el remote y vuelve a crearlo
git remote remove origin
git remote add origin https://github.com/TU_USUARIO/BYD-Stats-Premium.git
```

#### **Error: "push declined due to protection rules"**
```bash
# Solución: Desactiva temporalmente branch protection en GitHub
# O haz push a través de Pull Request
```

#### **Pusheé código premium al público por error**
```bash
# Solución URGENTE:
# 1. Elimina la branch del público inmediatamente
git push public :feat/pybyd-integration

# 2. Si ya está en el historial de main, necesitas force push (cuidado!)
# Contacta a GitHub Support para limpiar el historial si es crítico
```

---

## ✅ Checklist de Seguridad

Antes de empezar a trabajar con esta configuración, verifica:

- [ ] Repo privado `BYD-Stats-Premium` creado en GitHub
- [ ] Remotes configurados (`origin` = privado, `public` = público)
- [ ] Branch `feat/pybyd-integration` eliminada del repo público
- [ ] Branch protection configurada en ambos repos
- [ ] Script `push-safe.sh` creado y funcional
- [ ] Aliases de git configurados
- [ ] `.gitignore` protege credenciales y keystores
- [ ] Has hecho un push de prueba a ambos repos

---

## 🎯 Resumen Ejecutivo

**Para trabajar diariamente:**
1. **Código compartido (PWA + APK)**: Trabaja en `main` → Push a `origin` y `public`
2. **Código premium (solo APK)**: Trabaja en `feat/pybyd-integration` → Push solo a `origin`
3. **Cuando tengas dudas**: Usa `bash push-safe.sh`

**Regla de oro**:
> ⚠️ La branch `feat/pybyd-integration` NUNCA debe ir al repo público

---

## 📞 Contacto y Soporte

Si tienes problemas con esta configuración:
1. Revisa esta documentación
2. Verifica los comandos de troubleshooting
3. Consulta con el equipo antes de hacer force pushes

---

**Última actualización**: 2026-02-22
**Autor**: Claude Code + Miguel
**Estado**: Pendiente de implementación
