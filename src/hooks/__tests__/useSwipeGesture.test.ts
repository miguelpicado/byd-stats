import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture } from '../useSwipeGesture';

const tabs = [
    { id: 'tab1', label: 'Tab 1' },
    { id: 'tab2', label: 'Tab 2' },
    { id: 'tab3', label: 'Tab 3' }
];

interface MockElement extends HTMLElement {
    simulateTouch: (type: string, x: number, y: number) => TouchEvent | null;
}

describe('useSwipeGesture', () => {
    let mockHandleTabClick: Mock<(tabId: string) => void>;
    let mockContainer: MockElement;

    beforeEach(() => {
        mockHandleTabClick = vi.fn();

        // Create a mock DOM element
        mockContainer = document.createElement('div') as unknown as MockElement;

        // Mock dimensions and scroll properties
        Object.defineProperty(mockContainer, 'scrollTop', { value: 0, writable: true });
        Object.defineProperty(mockContainer, 'scrollHeight', { value: 1000, writable: true });
        Object.defineProperty(mockContainer, 'clientHeight', { value: 500, writable: true });

        // We must mock addEventListener to capture handlers
        const listeners: Record<string, EventListener> = {};
        vi.spyOn(mockContainer, 'addEventListener').mockImplementation((type, handler) => {
            listeners[type] = handler as EventListener;
        });

        // Helper to simulate touches
        mockContainer.simulateTouch = (type: string, x: number, y: number) => {
            if (listeners[type]) {
                const touch = { clientX: x, clientY: y };
                const event = {
                    touches: type !== 'touchend' ? [touch] : [],
                    changedTouches: type === 'touchend' ? [touch] : [],
                    preventDefault: vi.fn(),
                    cancelable: true
                } as unknown as TouchEvent;
                listeners[type](event);
                return event;
            }
            return null;
        };
    });

    it('sets up event listeners on the container', () => {
        const { result } = renderHook(() => useSwipeGesture({
            activeTab: 'tab1',
            handleTabClick: mockHandleTabClick,
            isTransitioning: false,
            tabs,
            layoutMode: 'horizontal'
        }));

        act(() => {
            result.current(mockContainer);
        });

        expect(mockContainer.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
        expect(mockContainer.addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
        expect(mockContainer.addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: true });
    });

    describe('horizontal layouts (like mobile)', () => {
        it('swipe left triggers next tab', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab1',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'horizontal',
                minSwipeDistance: 30
            }));

            act(() => result.current(mockContainer));

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 50, 100); // Moved left 50px
                mockContainer.simulateTouch('touchend', 50, 100);
            });

            expect(mockHandleTabClick).toHaveBeenCalledWith('tab2');
        });

        it('swipe right triggers prev tab', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab2',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'horizontal',
                minSwipeDistance: 30
            }));

            act(() => result.current(mockContainer));

            act(() => {
                mockContainer.simulateTouch('touchstart', 50, 100);
                mockContainer.simulateTouch('touchmove', 100, 100); // Moved right 50px
                mockContainer.simulateTouch('touchend', 100, 100);
            });

            expect(mockHandleTabClick).toHaveBeenCalledWith('tab1');
        });

        it('ignores swipes shorter than min distance', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab1',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'horizontal',
                minSwipeDistance: 50 // High threshold
            }));

            act(() => result.current(mockContainer));

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 80, 100); // Moved left 20px
                mockContainer.simulateTouch('touchend', 80, 100);
            });

            expect(mockHandleTabClick).not.toHaveBeenCalled();
        });

        it('swipe down at top of scroll triggers prev tab (pull to refresh gesture)', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab2',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'horizontal',
                minSwipeDistance: 30
            }));

            act(() => result.current(mockContainer));
            mockContainer.scrollTop = 0; // At top

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 100, 150); // Swipe down 50px
                mockContainer.simulateTouch('touchend', 100, 150);
            });

            expect(mockHandleTabClick).toHaveBeenCalledWith('tab1');
        });

        it('ignores swipe down when NOT at the top of scroll', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab2',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'horizontal',
                minSwipeDistance: 30
            }));

            act(() => result.current(mockContainer));
            mockContainer.scrollTop = 100; // Not at top

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 100, 150); // Swipe down 50px
                mockContainer.simulateTouch('touchend', 100, 150);
            });

            expect(mockHandleTabClick).not.toHaveBeenCalled();
        });
    });

    describe('vertical layouts (like desktop sidebar)', () => {
        it('swipe up/down does not trigger tab changes in vertical mode', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab2',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'vertical',
                minSwipeDistance: 30
            }));

            act(() => result.current(mockContainer));
            mockContainer.scrollTop = 0;

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 100, 150); // Swipe down 50px
                mockContainer.simulateTouch('touchend', 100, 150);
            });

            expect(mockHandleTabClick).not.toHaveBeenCalled();

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 150);
                mockContainer.simulateTouch('touchmove', 100, 100); // Swipe up 50px
                mockContainer.simulateTouch('touchend', 100, 100);
            });

            expect(mockHandleTabClick).not.toHaveBeenCalled();
        });

        it('horizontal swipe still works in vertical mode', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab2',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'vertical',
                minSwipeDistance: 30
            }));

            act(() => result.current(mockContainer));

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 50, 100); // Swipe left 50px
                mockContainer.simulateTouch('touchend', 50, 100);
            });

            expect(mockHandleTabClick).toHaveBeenCalledWith('tab3');
        });
    });

    describe('guards', () => {
        it('disables swipes when modal is open', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab1',
                handleTabClick: mockHandleTabClick,
                isTransitioning: false,
                tabs,
                layoutMode: 'horizontal',
                isModalOpen: true
            }));

            act(() => result.current(mockContainer));

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 50, 100);
                mockContainer.simulateTouch('touchend', 50, 100);
            });

            expect(mockHandleTabClick).not.toHaveBeenCalled();
        });

        it('disables swipes during tab transition', () => {
            const { result } = renderHook(() => useSwipeGesture({
                activeTab: 'tab1',
                handleTabClick: mockHandleTabClick,
                isTransitioning: true,
                tabs,
                layoutMode: 'horizontal'
            }));

            act(() => result.current(mockContainer));

            act(() => {
                mockContainer.simulateTouch('touchstart', 100, 100);
                mockContainer.simulateTouch('touchmove', 50, 100);
                mockContainer.simulateTouch('touchend', 50, 100);
            });

            expect(mockHandleTabClick).not.toHaveBeenCalled();
        });
    });
});
