import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, TrendingUp, Clock, Zap, BarChart3, List, Battery, Calendar, Car, LayoutDashboard } from '../components/Icons';
import { Settings } from '@/types';

import type { FC } from 'react';
import { IconProps } from '@components/Icons';

interface Tab {
    id: string;
    label: string;
    icon: FC<IconProps>;
}

interface UseTabNavigationProps {
    settings: Settings;
    isVertical?: boolean;
    isNative?: boolean;
}

export const useTabNavigation = ({ settings, isVertical = false, isNative = false }: UseTabNavigationProps) => {
    const { t } = useTranslation();

    // Initial tab from URL hash or default 'overview'
    const getInitialTab = (): string => {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['dashboard', 'vehicle', 'overview', 'calendar', 'trends', 'patterns', 'efficiency', 'records', 'history', 'charges'];

        // Platform & Orientation Logic
        // ------------------------------------------------------------

        // 1. Horizontal Mode (Tablet/Desktop) -> Hide 'vehicle' & 'dashboard' (maybe? for now hide vehicle)
        if (!isVertical) {
            if (['vehicle', 'dashboard'].includes(hash)) return 'overview';
        }
        // 2. Vertical Mode (Mobile)
        else {
            // 2a. Native APK (Premium) -> Hide 'overview', 'history', 'charges', 'vehicle' (replaced by dashboard)
            if (isNative) {
                // Dashboard is the new home for Native
                if (['overview', 'history', 'charges', 'vehicle'].includes(hash)) return 'dashboard';
                // Allow specific tabs if needed, but default is dashboard
            }
            // 2b. PWA (Free) -> Hide 'vehicle', 'dashboard'
            else {
                if (['vehicle', 'dashboard'].includes(hash)) return 'overview';
            }
        }

        return validTabs.includes(hash) ? hash : (isNative && isVertical ? 'dashboard' : 'overview');
    };

    const [activeTab, setActiveTab] = useState<string>(getInitialTab);
    const [fadingTab, setFadingTab] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

    // Constants
    const transitionDuration = 500;

    const tabs: Tab[] = useMemo(() => {
        const allTabs = [
            { id: 'dashboard', label: t('tabs.dashboard', 'Dashboard'), icon: LayoutDashboard }, // New Dashboard Tab
            { id: 'vehicle', label: t('tabs.vehicle', 'Mi Coche'), icon: Car },
            { id: 'overview', label: t('tabs.overview'), icon: Activity },
            { id: 'calendar', label: t('tabs.calendar'), icon: Calendar },
            { id: 'trends', label: t('tabs.trends'), icon: TrendingUp },
            { id: 'patterns', label: t('tabs.patterns'), icon: Clock },
            { id: 'efficiency', label: t('tabs.efficiency'), icon: Zap },
            { id: 'records', label: t('tabs.records'), icon: BarChart3 },
            { id: 'history', label: t('tabs.history'), icon: List },
            { id: 'charges', label: t('tabs.charges'), icon: Battery }
        ];

        return allTabs.filter(t => {
            // 1. Check user settings (custom hidden tabs)
            if (t.id !== 'overview' && t.id !== 'vehicle' && (settings.hiddenTabs || []).includes(t.id)) return false;

            // 2. Platform & Mode Restrictions
            if (isVertical) {
                if (isNative) {
                    // APK (Premium): Show 'dashboard', 'history', 'charges'. Hide 'overview', 'vehicle'.
                    if (['overview', 'vehicle'].includes(t.id)) return false;
                } else {
                    // PWA (Free): Hide 'vehicle', 'dashboard'. Show 'overview', 'history', 'charges'.
                    if (['vehicle', 'dashboard'].includes(t.id)) return false;
                }
            } else {
                // Horizontal: Hide 'vehicle' & 'dashboard' (Desktop/Tablet flow).
                if (['vehicle', 'dashboard'].includes(t.id)) return false;
            }

            return true;
        });
    }, [t, settings.hiddenTabs, isVertical, isNative]);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = () => {
            const hash = window.location.hash.replace('#', '');
            const validTabs = tabs.map(t => t.id);
            const newTab = validTabs.includes(hash) ? hash : 'overview';

            if (newTab !== activeTab) {
                setActiveTab(newTab);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeTab, tabs]);

    // Sync state changes to URL
    useEffect(() => {
        const currentHash = window.location.hash.replace('#', '');
        if (currentHash !== activeTab) {
            // Use replaceState if initial load to avoid pushing 'overview' history if generic
            // Check if activeTab is the "default" for the current mode
            const isDefault = (isNative && isVertical) ? activeTab === 'vehicle' : activeTab === 'overview';

            if (isDefault && !currentHash) {
                window.history.replaceState(null, '', `${window.location.search}#${activeTab}`);
            } else {
                window.history.pushState(null, '', `${window.location.search}#${activeTab}`);
            }
        }
    }, [activeTab, isNative, isVertical]);

    // NEW: Redirect if active tab becomes hidden (e.g. rotation or resize)
    useEffect(() => {
        const isTabVisible = tabs.find(t => t.id === activeTab);
        if (!isTabVisible) {
            // Fallback to first available tab
            const fallback = tabs.length > 0 ? tabs[0].id : 'overview';
            if (activeTab !== fallback) {
                setActiveTab(fallback);
            }
        }
    }, [tabs, activeTab]);

    const handleTabClick = useCallback((tabId: string) => {
        if (tabId === activeTab) return;
        if (isTransitioning) return;

        // Use transitions for both vertical and horizontal modes
        setIsTransitioning(true);
        setActiveTab(tabId);
        setFadingTab(tabId); // Mark this tab for fade-in animation

        setTimeout(() => {
            setIsTransitioning(false);
            setFadingTab(null); // Clear animation after transition
        }, transitionDuration);
    }, [activeTab, isTransitioning, transitionDuration]);

    return {
        activeTab,
        setActiveTab,
        fadingTab,
        isTransitioning, // Exposed for MainLayout or other consumers
        handleTabClick,
        tabs
    };
};
