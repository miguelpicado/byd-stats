#!/bin/bash
# Safe Push Script para BYD-Stats
# Previene pushes accidentales de código premium al repo público

CURRENT_BRANCH=$(git branch --show-current)

echo "🔍 Branch actual: $CURRENT_BRANCH"

# Lista de branches privadas que NO deben ir al público
PRIVATE_BRANCHES=("PremiumAPK" "pybyd-integration" "feat/pybyd" "premium" "private")

is_private_branch() {
    for branch in "${PRIVATE_BRANCHES[@]}"; do
        if [[ "$CURRENT_BRANCH" == *"$branch"* ]]; then
            return 0
        fi
    done
    return 1
}

# Si es branch privada
if is_private_branch; then
    echo "⚠️  Branch PRIVADA detectada: $CURRENT_BRANCH"
    echo "📤 Pusheando SOLO a origin (privado)..."
    git push origin "$CURRENT_BRANCH"
    echo "✅ Push completado SOLO en repo privado"
else
    echo "✅ Branch PÚBLICA detectada: $CURRENT_BRANCH"
    echo "📤 Pusheando a AMBOS repos..."

    # Push al privado
    git push origin "$CURRENT_BRANCH"
    echo "✅ Push a origin (privado) completado"

    # Confirmar push al público
    read -p "¿Push también al repo público? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push public "$CURRENT_BRANCH"
        echo "✅ Push a public completado"
    else
        echo "⏭️  Push al público omitido"
    fi
fi
