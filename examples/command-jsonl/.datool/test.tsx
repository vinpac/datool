import {
  TraceViewer,
  type DatoolTraceGroupsConfig,
  type DatoolTraceSchema,
} from "datool"

import type { ToyTraceGroupRow, ToyTraceRow } from "./sources"

const schema: DatoolTraceSchema<ToyTraceRow> = {
  mapRow(row) {
    return row
  },
  resources: {
    database: {
      color: "emerald",
      label: ({ span }) => `DB: ${span.name}`,
    },
    function: {
      color: "amber",
      label: ({ span }) => `${span.name}()`,
    },
    workflow: {
      color: "violet",
      label: ({ span }) => `Workflow: ${span.name}`,
    },
  },
  slice: {
    columns: [
      {
        accessorKey: "type",
        label: "Type",
      },
      {
        accessorKey: "name",
        label: "Name",
      },
      {
        accessorKey: "resource",
        label: "Resource",
      },
      {
        accessorKey: "timestamp",
        label: "Event Time",
      },
      {
        accessorKey: "startTime",
        label: "Start",
      },
      {
        accessorKey: "endTime",
        label: "End",
      },
      {
        accessorKey: "color",
        label: "Marker Color",
      },
      {
        accessorKey: "showVerticalLine",
        label: "Vertical Line",
      },
      {
        accessorKey: "attributes.note",
        label: "What This Shows",
      },
    ],
    description:
      "This toy trace demonstrates resource colors, queued time, and event marker options.",
    title: ({ selectedSpan }) => `${selectedSpan.name} source rows`,
  },
}

const groups: DatoolTraceGroupsConfig<ToyTraceGroupRow, ToyTraceRow> = {
  displayName: "displayName",
  id: "id",
  label: "Workflow",
  placeholder: "Select a workflow",
  traces: "traces",
}

export default function TracePage() {
  return <TraceViewer groups={groups} schema={schema} source="toyTrace" />
}
