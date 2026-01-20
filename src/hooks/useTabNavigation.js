import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, TrendingUp, Clock, Zap, BarChart3, List, Battery } from '../components/Icons';

export const useTabNavigation = ({ settings }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('overview');
    const [fadingTab, setFadingTab] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Constants
    const transitionDuration = 500;

    const tabs = useMemo(() => [
        { id: 'overview', label: t('tabs.overview'), icon: Activity },
        { id: 'trends', label: t('tabs.trends'), icon: TrendingUp },
        { id: 'patterns', label: t('tabs.patterns'), icon: Clock },
        { id: 'efficiency', label: t('tabs.efficiency'), icon: Zap },
        { id: 'records', label: t('tabs.records'), icon: BarChart3 },
        { id: 'history', label: t('tabs.history'), icon: List },
        { id: 'charges', label: t('tabs.charges'), icon: Battery }
    ].filter(t => t.id === 'overview' || !(settings.hiddenTabs || []).includes(t.id)), [t, settings.hiddenTabs]);

    const handleTabClick = useCallback((tabId) => {
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
