import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../../context/ThemeContext';
import Layout from '../Layout';

// Create a wrapper with all required providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }) => (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

const renderWithProviders = (component) => {
  return render(component, { wrapper: createWrapper() });
};

describe('Sidebar', () => {
  it('renders the sidebar with navigation links', () => {
    renderWithProviders(<Layout />);
    
    // Check that all navigation items are present in the nav
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
    
    // Use getAllByText for items that appear multiple times
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Tracked')).toBeInTheDocument();
    expect(screen.getByText('Price Drops')).toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the logo and brand name', () => {
    renderWithProviders(<Layout />);
    
    expect(screen.getByText('Price Tracker')).toBeInTheDocument();
  });

  it('renders system status indicator', () => {
    renderWithProviders(<Layout />);
    
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText('All services running')).toBeInTheDocument();
  });

  it('renders version number', () => {
    renderWithProviders(<Layout />);
    
    expect(screen.getByText('Price Tracker v1.0.0')).toBeInTheDocument();
  });

  it('has navigation links with correct hrefs', () => {
    renderWithProviders(<Layout />);
    
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const productsLink = screen.getByRole('link', { name: /products/i });
    const trackedLink = screen.getByRole('link', { name: /tracked/i });
    const priceDropsLink = screen.getByRole('link', { name: /price drops/i });
    const compareLink = screen.getByRole('link', { name: /compare/i });
    const alertsLink = screen.getByRole('link', { name: /alerts/i });
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    
    expect(dashboardLink).toHaveAttribute('href', '/');
    expect(productsLink).toHaveAttribute('href', '/products');
    expect(trackedLink).toHaveAttribute('href', '/tracked');
    expect(priceDropsLink).toHaveAttribute('href', '/price-drops');
    expect(compareLink).toHaveAttribute('href', '/compare');
    expect(alertsLink).toHaveAttribute('href', '/alerts');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('renders desktop sidebar with correct visibility classes', () => {
    renderWithProviders(<Layout />);
    
    // The desktop sidebar should have 'hidden lg:flex' classes
    // Using a more flexible selector
    const sidebars = document.querySelectorAll('aside');
    expect(sidebars.length).toBeGreaterThan(0);
    
    // Check that at least one sidebar exists with the correct structure
    const desktopSidebar = Array.from(sidebars).find(sidebar => 
      sidebar.className.includes('hidden') && sidebar.className.includes('lg:flex')
    );
    expect(desktopSidebar).toBeTruthy();
  });

  it('renders main navigation with aria-label', () => {
    renderWithProviders(<Layout />);
    
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
  });
});

describe('Layout', () => {
  it('renders the layout structure', () => {
    renderWithProviders(<Layout />);
    
    // Check main content area exists
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');
  });

  it('renders skip link for accessibility', () => {
    renderWithProviders(<Layout />);
    
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});
