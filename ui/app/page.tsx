"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import { TradingLayout, MobileLayout } from "@/components/layout";
import {
  ChartPanel,
  TradePanel,
  PositionsPanel,
} from "@/components/trading";
import { useAllMarkets } from "@/hooks/useMarketData";
import { usePositions } from "@/hooks/usePositions";
import { type RegimeType } from "@/components/ui";

// Mock data for demo
const mockMarkets = [
  {
    id: "xau-usd",
    name: "Gold Spot",
    symbol: "XAU/USD",
    price: "2,341.50",
    change24h: 1.24,
    regime: "open" as RegimeType,
    volume24h: "12.5M",
  },
  {
    id: "spx-usd",
    name: "S&P 500",
    symbol: "SPX/USD",
    price: "5,234.18",
    change24h: -0.32,
    regime: "off-hours" as RegimeType,
    volume24h: "8.2M",
  },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export default function TradePage() {
  const { address } = useAccount();
  const isMobile = useIsMobile();
  const [selectedMarketId, setSelectedMarketId] = useState("xau-usd");
  const [mobileTab, setMobileTab] = useState<"chart" | "trade" | "positions">("chart");

  const { markets: contractMarkets, isLoading: marketsLoading } = useAllMarkets();
  const { positions: rawPositions, isLoading: positionsLoading } = usePositions(address);

  // Merge mock data with contract data
  const markets = useMemo(() => {
    if (!contractMarkets || contractMarkets.length === 0) {
      return mockMarkets;
    }

    return mockMarkets.map((mock) => {
      const contract = contractMarkets.find(
        (c) =>
          c.id.toLowerCase().includes(mock.id.split("-")[0]) ||
          mock.id.includes(c.id.toLowerCase())
      );

      if (contract) {
        const priceValue = contract.markPrice
          ? (Number(contract.markPrice / BigInt(10 ** 16)) / 100).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : mock.price;

        return {
          ...mock,
          price: priceValue,
          regime: (["open", "off-hours", "transition", "stress"][
            contract.regime || 0
          ] || "open") as RegimeType,
        };
      }
      return mock;
    });
  }, [contractMarkets]);

  const selectedMarket = markets.find((m) => m.id === selectedMarketId) || markets[0];

  // Transform positions for display
  const positions = useMemo(() => {
    if (!rawPositions) return [];

    return rawPositions
      .filter((p) => p.size > 0n)
      .map((p, i) => ({
        id: `pos-${i}`,
        market: selectedMarket?.symbol || "XAU/USD",
        side: p.isLong ? ("long" as const) : ("short" as const),
        size: (Number(p.size) / 1e18).toFixed(2),
        entryPrice: (Number(p.entryPrice) / 1e18).toFixed(2),
        markPrice: selectedMarket?.price?.toString().replace(/,/g, "") || "0",
        pnl: Number(p.size) / 1e18 * 0.05,
        pnlPercent: 2.5,
        margin: (Number(p.margin) / 1e6).toFixed(2),
        leverage: 5,
        liquidationPrice: (Number(p.entryPrice) / 1e18 * 0.85).toFixed(2),
      }));
  }, [rawPositions, selectedMarket]);

  const handleSubmitOrder = async (order: {
    side: "long" | "short";
    size: string;
    margin: string;
    leverage: number;
  }) => {
    console.log("Submitting order:", order);
  };

  const handleClosePosition = async (positionId: string) => {
    console.log("Closing position:", positionId);
  };

  // Mobile content renderer
  const renderMobileContent = () => {
    switch (mobileTab) {
      case "chart":
        return (
          <ChartPanel
            symbol={selectedMarket?.symbol || "XAU/USD"}
            className="h-full"
          />
        );
      case "trade":
        return (
          <TradePanel
            marketSymbol={selectedMarket?.symbol || "XAU/USD"}
            markPrice={selectedMarket?.price?.toString().replace(/,/g, "") || "0"}
            maxLeverage={100}
            onSubmitOrder={handleSubmitOrder}
          />
        );
      case "positions":
        return (
          <PositionsPanel
            positions={positions}
            orders={[]}
            trades={[]}
            isLoading={positionsLoading}
            onClosePosition={handleClosePosition}
          />
        );
    }
  };

  // Render mobile layout
  if (isMobile) {
    return (
      <MobileLayout activeTab={mobileTab} onTabChange={setMobileTab}>
        {renderMobileContent()}
      </MobileLayout>
    );
  }

  // Render desktop layout
  return (
    <TradingLayout
      centerTop={
        <ChartPanel
          symbol={selectedMarket?.symbol || "XAU/USD"}
          className="h-full"
        />
      }
      centerBottom={
        <PositionsPanel
          positions={positions}
          orders={[]}
          trades={[]}
          isLoading={positionsLoading}
          onClosePosition={handleClosePosition}
        />
      }
      rightPanel={
        <TradePanel
          marketSymbol={selectedMarket?.symbol || "XAU/USD"}
          markPrice={selectedMarket?.price?.toString().replace(/,/g, "") || "0"}
          maxLeverage={100}
          onSubmitOrder={handleSubmitOrder}
        />
      }
    />
  );
}
