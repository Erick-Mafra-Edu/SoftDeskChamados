"use client";

import dynamic from "next/dynamic";
import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

export function EChartCard({
  title,
  subtitle,
  option,
}: {
  title: string;
  subtitle: string;
  option: EChartsOption;
}) {
  return (
    <Card size="4" className="glass-panel">
      <Flex direction="column" gap="1" mb="4">
        <Heading size="5">{title}</Heading>
        <Text size="2" color="gray">
          {subtitle}
        </Text>
      </Flex>
      <div className="chart-host">
        <ReactECharts option={option} style={{ height: 320, width: "100%" }} />
      </div>
    </Card>
  );
}
