"use client";

import { Badge, Box, Card, Flex, Heading, ScrollArea, Text } from "@radix-ui/themes";
import type { Chamado } from "@/types/softdesk";
import type { KanbanConfig } from "@/lib/dashboard/storage";
import { buildKanbanColumns } from "@/lib/dashboard/kanban";
import { formatDate } from "@/lib/analysis/chamados";

export function KanbanBoard({
  items,
  config,
  onOpenDetail,
  onMoveItem,
  onMoveColumn,
}: {
  items: Chamado[];
  config: KanbanConfig;
  onOpenDetail: (item: Chamado) => void;
  onMoveItem: (item: Chamado, targetColumnId: string) => void;
  onMoveColumn: (sourceColumnId: string, targetColumnId: string) => void;
}) {
  const columns = buildKanbanColumns(items, config);

  return (
    <ScrollArea type="always" scrollbars="horizontal">
      <Flex gap="4" px="4" pb="4" minWidth="max-content" align="start">
        {columns.map((column) => (
          <Card
            key={column.id}
            size="3"
            variant="surface"
            style={{ width: 320, minHeight: 320, flexShrink: 0 }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const draggedColumnId = event.dataTransfer.getData("application/x-kanban-column");
              if (draggedColumnId && draggedColumnId !== column.id) {
                onMoveColumn(draggedColumnId, column.id);
                return;
              }

              const raw = event.dataTransfer.getData("text/plain");
              const item = items.find((current) => String(current.cd_chamado) === raw);

              if (item) {
                onMoveItem(item, column.id);
              }
            }}
          >
            <Flex direction="column" gap="3">
              <Flex align="center" justify="between" gap="3">
                <Box
                  draggable={column.id !== "__OTHER__"}
                  onDragStart={(event) => {
                    if (column.id === "__OTHER__") {
                      return;
                    }

                    event.dataTransfer.setData(
                      "application/x-kanban-column",
                      column.id,
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  style={{
                    cursor: column.id === "__OTHER__" ? "default" : "grab",
                  }}
                >
                  <Heading size="4">{column.label}</Heading>
                  <Text size="2" color="gray">
                    {column.items.length} chamados
                  </Text>
                </Box>
                <Badge variant="soft" color="blue">
                  {column.items.length}
                </Badge>
              </Flex>

              <Flex direction="column" gap="3">
                {column.items.length === 0 ? (
                  <Card variant="surface">
                    <Text size="2" color="gray">
                      Nenhum chamado nesta coluna.
                    </Text>
                  </Card>
                ) : (
                  column.items.map((item) => (
                    <Card
                      key={item.cd_chamado}
                      variant="surface"
                      style={{ cursor: "pointer" }}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", String(item.cd_chamado));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => onOpenDetail(item)}
                    >
                      <Flex direction="column" gap="2">
                        <Flex justify="between" gap="2" align="start">
                          <Text size="2" weight="bold">
                            #{item.cd_chamado}
                          </Text>
                          <Badge variant="soft" color="gray">
                            {formatDate(item.da_chamado)}
                          </Badge>
                        </Flex>
                        <Text size="2" style={{ lineHeight: 1.45 }}>
                          {item.tt_chamado}
                        </Text>
                        <Text size="1" color="gray">
                          {item.nm_cliente ?? "Cliente nao informado"}
                        </Text>
                        <Flex gap="2" wrap="wrap">
                          {item.ds_status ? <Badge variant="soft">{item.ds_status}</Badge> : null}
                          {item.ds_prioridade ? (
                            <Badge variant="soft" color="amber">
                              {item.ds_prioridade}
                            </Badge>
                          ) : null}
                        </Flex>
                      </Flex>
                    </Card>
                  ))
                )}
              </Flex>
            </Flex>
          </Card>
        ))}
      </Flex>
    </ScrollArea>
  );
}
