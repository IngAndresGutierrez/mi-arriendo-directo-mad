import { LoadingScreen, Skeleton } from "@/shared/ui/skeleton";

/** The tenancy page: a heading, the term, where to pay, and the months. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el arriendo…">
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-9 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />

        {/* El resumen del término y la cuenta a la que se paga. */}
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-52 w-full rounded-2xl" />
        {/* El mes que toca, que es lo que trae a alguien aquí. */}
        <Skeleton className="mt-6 h-44 w-full rounded-2xl" />

        <div className="mt-6 space-y-2">
          {/* Cuatro de los doce: las que caben antes del pliegue, que es lo que se ve. */}
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </LoadingScreen>
  );
}
