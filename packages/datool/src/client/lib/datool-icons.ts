import {
  Ban,
  Check,
  CircleAlert,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Info,
  Play,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react"
import type { ComponentType } from "react"

import type { DatoolIconName } from "../../shared/types"

export const LOG_VIEWER_ICONS: Record<
  DatoolIconName,
  ComponentType<{ className?: string }>
> = {
  Ban,
  Check,
  CircleAlert,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Info,
  Play,
  RefreshCcw,
  Search,
  Trash: Trash2,
  X,
}
