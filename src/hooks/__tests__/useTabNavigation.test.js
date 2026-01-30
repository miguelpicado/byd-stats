import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTabNavigation } from '../useTabNavigation';

// Mock react-i18next
const mockT = vi.fn((key) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    }
}));

// Mock Icons to avoid SVG rendering issues or just to keep it simple
vi.mock('../components/Icons', () => ({
    Activity: () => 'ActivityIcon',
    TrendingUp: () => 'TrendingUpIcon',
    Clock: () => 'ClockIcon',
    Zap: () => 'ZapIcon',
    BarChart3: () => 'BarChart3Icon',
    List: () => 'ListIcon',
    Battery: () => 'BatteryIcon',
    Calendar: () => 'CalendarIcon'
}));

describe('useTabNavigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        window.location.hash = '';
    });

    it('should initialize with default active tab', () => {
        const { result } = renderHook(() => useTabNavigation({ settings: {} }));
        expect(result.current.activeTab).toBe('overview');
        expect(result.current.isTransitioning).toBe(false);
    });

    it('should handle tab clicks and manage transition state', () => {
        const { result } = renderHook(() => useTabNavigation({ settings: {} }));

        act(() => {
            result.current.handleTabClick('trends');
        });

        expect(result.current.activeTab).toBe('trends');
        expect(result.current.isTransitioning).toBe(true);
        expect(result.current.fadingTab).toBe('trends');

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current.isTransitioning).toBe(false);
        expect(result.current.fadingTab).toBe(null);
    });

    it('should not allow clicking the current active tab', () => {
        const { result } = renderHook(() => useTabNavigation({ settings: {} }));

        expect(result.current.activeTab).toBe('overview');

        act(() => {
            result.current.handleTabClick('overview');
        });

        expect(result.current.isTransitioning).toBe(false);
    });

    it('should filter tabs correctly based on hiddenTabs settings', () => {
        const settings = { hiddenTabs: ['trends', 'patterns'] };
        const { result } = renderHook(() => useTabNavigation({ settings }));

        const tabIds = result.current.tabs.map(t => t.id);
        expect(tabIds).toContain('overview');
        expect(tabIds).not.toContain('trends');
        expect(tabIds).not.toContain('patterns');
        expect(tabIds).toContain('efficiency');
    });

    it('should always include overview tab even if hidden', () => {
        // Even if the user tries to hide overview, it should stay (based on current implementation logic)
        const settings = { hiddenTabs: ['overview'] };
        const { result } = renderHook(() => useTabNavigation({ settings }));

        const tabIds = result.current.tabs.map(t => t.id);
        expect(tabIds).toContain('overview');
    });

    it('should prevent tab clicks during transition', () => {
        const { result } = renderHook(() => useTabNavigation({ settings: {} }));

        act(() => {
            result.current.handleTabClick('trends');
        });

        expect(result.current.activeTab).toBe('trends');
        expect(result.current.isTransitioning).toBe(true);

        // Try to click another tab immediately
        act(() => {
            result.current.handleTabClick('patterns');
        });

        // Current tab should still be trends
        expect(result.current.activeTab).toBe('trends');
    });
});

