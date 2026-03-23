"use client"

import * as React from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  PanelLeftIcon,
} from "lucide-react"

import type { DatoolClientPage } from "../../shared/types"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

type SidebarGroupItem = {
  pages: DatoolClientPage[]
  segment: string
}

function toSegmentLabel(segment: string) {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function buildSidebarGroups(pages: DatoolClientPage[]) {
  const rootPages: DatoolClientPage[] = []
  const groups = new Map<string, DatoolClientPage[]>()

  for (const page of pages) {
    const segments = page.path.split("/").filter(Boolean)

    if (segments.length <= 1) {
      rootPages.push(page)
      continue
    }

    const topLevelSegment = segments[0]!
    const existingPages = groups.get(topLevelSegment)

    if (existingPages) {
      existingPages.push(page)
    } else {
      groups.set(topLevelSegment, [page])
    }
  }

  return {
    groups: Array.from(groups.entries())
      .map<SidebarGroupItem>(([segment, groupedPages]) => ({
        pages: groupedPages.sort((left, right) => left.path.localeCompare(right.path)),
        segment,
      }))
      .sort((left, right) => left.segment.localeCompare(right.segment)),
    rootPages: rootPages.sort((left, right) => left.path.localeCompare(right.path)),
  }
}

function PageLink({
  isActive,
  page,
  sub = false,
}: {
  isActive: boolean
  page: DatoolClientPage
  sub?: boolean
}) {
  if (sub) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <NavLink to={page.path}>
            <FileTextIcon />
            <span>{page.title}</span>
          </NavLink>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <NavLink to={page.path}>
          {page.path === "/" ? <HomeIcon /> : <FileTextIcon />}
          <span>{page.title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  pages,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  pages: DatoolClientPage[]
}) {
  const location = useLocation()
  const sidebar = React.useMemo(() => buildSidebarGroups(pages), [pages])

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === "/"}>
              <NavLink to="/">
                <PanelLeftIcon />
                <span>Datool</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebar.rootPages.map((page) => (
                <PageLink
                  isActive={location.pathname === page.path}
                  key={page.id}
                  page={page}
                />
              ))}
              {sidebar.groups.map((group) => {
                const groupIsActive = group.pages.some(
                  (page) => location.pathname === page.path
                )

                return (
                  <SidebarMenuItem key={group.segment}>
                    <SidebarMenuButton isActive={groupIsActive}>
                      <FolderIcon />
                      <span>{toSegmentLabel(group.segment)}</span>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      {group.pages.map((page) => (
                        <PageLink
                          isActive={location.pathname === page.path}
                          key={page.id}
                          page={page}
                          sub
                        />
                      ))}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
