/**
 * SkeletonCard — Placeholder animado mientras se cargan los datos.
 * Uso: mostrar mientras isProcessing === true en listas de viajes/cargas.
 */
const SkeletonCard = ({ lines = 3 }: { lines?: number }) => (
    <div
        className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse bg-white dark:bg-slate-800/50"
        role="status"
        aria-label="Loading"
    >
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
        {Array.from({ length: lines - 1 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
        ))}
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        <span className="sr-only">Cargando...</span>
    </div>
);

export default SkeletonCard;
