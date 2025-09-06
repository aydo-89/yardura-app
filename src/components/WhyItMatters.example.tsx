// Example usage of WhyItMatters component
import WhyItMatters from './WhyItMatters';

export default function ExamplePage() {
  const handleGetQuote = () => {
    console.log('Get quote clicked');
    // Navigate to quote form or open modal
  };

  const handleInsights = () => {
    console.log('Insights clicked');
    // Navigate to insights page or scroll to section
  };

  return (
    <div>
      {/* Other page content */}
      <WhyItMatters onGetQuoteClick={handleGetQuote} onInsightsClick={handleInsights} />
      {/* More content */}
    </div>
  );
}

// Alternative usage without handlers (uses default anchor links)
export function SimpleUsage() {
  return (
    <div>
      {/* Component will use #quote and #insights anchors by default */}
      <WhyItMatters />
    </div>
  );
}

