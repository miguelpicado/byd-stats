/**
 * Shared test provider utilities.
 *
 * Usage:
 *   import { AllProviders, renderWithProviders } from '@test-utils/providers';
 *
 * NOTE: Tests that use these utilities must mock external dependencies that
 * AppProviders pulls in (firebase, @react-oauth/google, @capacitor/core, etc.).
 * See src/providers/__tests__/ProviderIntegration.test.tsx for the required mocks.
 */
import React, { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AppProviders } from '@/providers/AppProviders';

/** Full provider tree — use as `wrapper` in renderHook or render calls. */
export const AllProviders = ({ children }: { children: ReactNode }) => (
    <AppProviders>{children}</AppProviders>
);

/** Convenience wrapper around RTL render that injects the full provider tree. */
export const renderWithProviders = (
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) => {
    return render(ui, { wrapper: AllProviders, ...options });
};
