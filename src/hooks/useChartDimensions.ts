import { useMemo } from 'react';

interface ChartDimensionsProps {
    isVertical?: boolean;
    isFullscreenBYD?: boolean;
    isCompact?: boolean;
}

interface ChartDimensions {
    smallChartHeight: number;
    patternsChartHeight: number;
    largeChartHeight: number;
    overviewSpacingVertical: string;
    overviewSpacingHorizontal: string;
    patternsSpacing: string;
    recordsItemPadding: string;
    recordsItemPaddingHorizontal: string;
    recordsListHeightHorizontal: string;
}

export const useChartDimensions = ({
    isVertical = false,
    isFullscreenBYD = false,
    isCompact = false
}: ChartDimensionsProps): ChartDimensions => {

    // Calculate chart heights based on mode - memoized to prevent recalculation
    const smallChartHeight = useMemo(() => {
        if (isVertical) return 350;
        if (isFullscreenBYD) return 271;
        if (isCompact) return 295;
        return 326;
    }, [isVertical, isFullscreenBYD, isCompact]);

    const patternsChartHeight = useMemo(() => {
        if (isVertical) return 350;
        if (isFullscreenBYD) return 289;
        if (isCompact) return 303;
        return 336;
    }, [isVertical, isFullscreenBYD, isCompact]);

    const largeChartHeight = useMemo(() => {
        if (isVertical) return 350;
        if (isFullscreenBYD) return 387;
        if (isCompact) return 369;
        return 442;
    }, [isVertical, isFullscreenBYD, isCompact]);

    // Spacing adjustments for different modes
    const unifiedVerticalSpacing = 'space-y-4';

    const overviewSpacingVertical = useMemo(() =>
        isVertical ? unifiedVerticalSpacing : (isFullscreenBYD ? 'space-y-[14px]' : (isCompact ? 'space-y-2.5' : 'space-y-3.5 sm:space-y-5')),
        [isVertical, isFullscreenBYD, isCompact]
    );

    const overviewSpacingHorizontal = useMemo(() =>
        isFullscreenBYD ? 'space-y-[22px]' : (isCompact ? 'space-y-2.5' : 'space-y-5 sm:space-y-6.5'),
        [isFullscreenBYD, isCompact]
    );

    const patternsSpacing = useMemo(() =>
        isVertical ? unifiedVerticalSpacing : (isFullscreenBYD ? 'space-y-[21px]' : (isCompact ? 'space-y-3' : 'space-y-[22px]')),
        [isVertical, isFullscreenBYD, isCompact]
    );

    const recordsItemPadding = useMemo(() =>
        isFullscreenBYD ? 'py-0.5' : (isCompact ? 'py-[1px]' : 'py-1.5'),
        [isFullscreenBYD, isCompact]
    );

    const recordsItemPaddingHorizontal = useMemo(() =>
        isFullscreenBYD ? 'py-1' : (isCompact ? 'py-[1.5px]' : 'py-2'),
        [isFullscreenBYD, isCompact]
    );

    const recordsListHeightHorizontal = useMemo(() =>
        isFullscreenBYD ? 'h-[389px]' : (isCompact ? 'h-[369px]' : 'h-[442px]'),
        [isFullscreenBYD, isCompact]
    );

    return {
        smallChartHeight,
        patternsChartHeight,
        largeChartHeight,
        overviewSpacingVertical,
        overviewSpacingHorizontal,
        patternsSpacing,
        recordsItemPadding,
        recordsItemPaddingHorizontal,
        recordsListHeightHorizontal
    };
};
