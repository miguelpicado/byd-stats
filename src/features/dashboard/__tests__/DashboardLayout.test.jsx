import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { Suspense } from 'react';
import DashboardLayout from '../DashboardLayout';

// Mock dependencies
const mockT = vi.fn((key) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    }
}));

vi.mock('@/providers/DataProvider', () => ({
    useData: () => ({
        stats: { summary: {}, monthly: {}, daily: {}, hourly: {}, weekday: {}, tripDist: {}, effScatter: {}, top: {} },
        trips: [], // rawTrips
        filtered: [],
        charges: [],
        openModal: vi.fn(),
        modals: {}
    })
}));

vi.mock('@/context/AppContext', () => ({
    useApp: () => ({
        settings: {
            batterySize: 60,
            chargerTypes: []
        }
    })
}));

vi.mock('@/context/LayoutContext', () => ({
    useLayout: () => ({
        layoutMode: 'vertical',
        isCompact: false,
        isFullscreenBYD: false,
        isVertical: true
    })
}));

vi.mock('@/hooks/useModalState', () => ({
    default: () => ({
        modals: {},
        openModal: vi.fn(),
        closeModal: vi.fn()
    })
}));

vi.mock('@/hooks/useChartDimensions', () => ({
    useChartDimensions: () => ({
        smallChartHeight: 200,
        largeChartHeight: 400,
        patternsChartHeight: 300,
        overviewSpacingVertical: 'space-y-4',
        overviewSpacingHorizontal: 'gap-4',
        patternsSpacing: 'gap-4',
        recordsItemPadding: 'p-4',
        recordsItemPaddingHorizontal: 'px-4',
        recordsListHeightHorizontal: 500
    })
}));

// Mock Child Components to avoid rendering charts
vi.mock('@/components/tabs/OverviewTab', () => ({
    default: () => <div data-testid="tab-overview">Overview Tab Content</div>
}));
vi.mock('@/components/tabs/TrendsTab', () => ({
    default: () => <div data-testid="tab-trends">Trends Tab Content</div>
}));
vi.mock('@/components/tabs/PatternsTab', () => ({
    default: () => <div data-testid="tab-patterns">Patterns Tab Content</div>
}));
vi.mock('@/components/tabs/EfficiencyTab', () => ({
    default: () => <div data-testid="tab-efficiency">Efficiency Tab Content</div>
}));
vi.mock('@/components/tabs/RecordsTab', () => ({
    default: () => <div data-testid="tab-records">Records Tab Content</div>
}));
vi.mock('@/components/tabs/HistoryTab', () => ({
    default: () => <div data-testid="tab-history">History Tab Content</div>
}));
vi.mock('@/components/tabs/ChargesTab', () => ({
    default: () => <div data-testid="tab-charges">Charges Tab Content</div>
}));

// Mock Common Components
vi.mock('@/components/common/TabFallback', () => ({
    default: () => <div data-testid="loading">Loading...</div>
}));
vi.mock('@/components/common/FloatingActionButton', () => ({
    default: ({ onClick, label }) => <button onClick={onClick}>{label}</button>
}));

describe('DashboardLayout', () => {
    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'trends', label: 'Trends' },
        { id: 'charges', label: 'Charges' }
    ];

    it('renders Overview tab by default in vertical mode', async () => {
        render(
            <Suspense fallback="Loading...">
                <DashboardLayout
                    activeTab="overview"
                    tabs={tabs}
                    isTransitioning={false}
                    onTripSelect={vi.fn()}
                    onChargeSelect={vi.fn()}
                />
            </Suspense>
        );

        expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
        expect(screen.queryByTestId('tab-trends')).not.toBeInTheDocument();
    });

    it('renders Trends tab when active', async () => {
        render(
            <Suspense fallback="Loading...">
                <DashboardLayout
                    activeTab="trends"
                    tabs={tabs}
                    isTransitioning={false}
                    onTripSelect={vi.fn()}
                    onChargeSelect={vi.fn()}
                />
            </Suspense>
        );

        // Wait for Suspense if needed (though we mocked with default export, sometimes dynamic imports behave oddly in tests unless mocked carefully)
        // Since we mocked the module path, it should be synchronous or standard promise resolution.
        await waitFor(() => {
            expect(screen.getByTestId('tab-trends')).toBeInTheDocument();
        });
    });

    it('renders Charges tab when active', async () => {
        render(
            <Suspense fallback="Loading...">
                <DashboardLayout
                    activeTab="charges"
                    tabs={tabs}
                    isTransitioning={false}
                    onTripSelect={vi.fn()}
                    onChargeSelect={vi.fn()}
                />
            </Suspense>
        );

        await waitFor(() => {
            expect(screen.getByTestId('tab-charges')).toBeInTheDocument();
        });
    });
});


