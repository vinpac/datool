import { StreamPageView } from "./components/stream-page-view"
import type { DatoolTableProps } from "./table-types"

export type { DatoolColumns, DatoolTableProps } from "./table-types"

export function Table(
  props: DatoolTableProps<Record<string, unknown>>
) {
  return (
    <StreamPageView
      columns={props.columns as never}
      stream={props.stream}
    />
  )
}
