import type { Product, ProductOptionValue, ProductOptionViewConfig, ProductView } from '@/src/config/products';

export interface EffectiveMockupResult {
  mockupUrl: string;
  printArea: ProductView['printArea'];
  viewId: string;
}

const normalizeViewName = (value?: string) => value?.trim().toLowerCase() ?? '';

const resolveViewConfig = (
  optionValue: ProductOptionValue,
  activeView: ProductView | undefined,
  baseViews: ProductView[],
): ProductOptionViewConfig | null => {
  if (!activeView) return null;

  const viewsConfig = optionValue.viewsConfig ?? {};
  const currentId = activeView.id;
  const currentName = normalizeViewName(activeView.name);
  const exactConfig = viewsConfig[currentId];
  if (exactConfig) return exactConfig;

  const namedConfig = currentName ? viewsConfig[currentName] : undefined;
  if (namedConfig) return namedConfig;

  const matchingKey = Object.keys(viewsConfig).find((key) => {
    const normalizedKey = normalizeViewName(key);
    return normalizedKey === normalizeViewName(currentId) || normalizedKey === currentName;
  });
  if (matchingKey) return viewsConfig[matchingKey];

  const matchingBaseView = baseViews.find((view) => normalizeViewName(view.name) === currentName);
  if (matchingBaseView) {
    const baseConfig = viewsConfig[matchingBaseView.id];
    if (baseConfig) return baseConfig;
  }

  return null;
};

export function getEffectiveMockup(
  product: Product,
  currentViewId: string,
  selectedOptions: Record<string, ProductOptionValue>,
  selectedColorId?: string,
): EffectiveMockupResult {
  const currentView = product.views.find((view) => view.id === currentViewId) ?? product.views[0];
  const safeViewId = currentView?.id ?? currentViewId;
  console.log('🔍 [RESOLVER MOCKUP - INICIO]:', {
    activeViewId: currentView?.id,
    activeViewName: currentView?.name,
    selectedOptionValues: Object.values(selectedOptions),
  });

  const defaultPrintArea: ProductView['printArea'] = currentView?.printArea ?? {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };

  const resolveFromValue = (value: ProductOptionValue): EffectiveMockupResult | null => {
    const keyedConfig = resolveViewConfig(value, currentView, product.views);
    console.log('🔍 [RESOLVER MOCKUP - INICIO]:', {
      activeViewId: currentView?.id,
      activeViewName: currentView?.name,
      selectedOptionValue: value,
      availableViewsConfigKeys: [
        ...(value.views?.map((view) => view.viewId) ?? []),
        ...Object.keys(value.mockupUrls ?? {}),
      ],
    });
    const currentViewName = currentView?.name.trim().toLowerCase();
    const matchedView = value.views?.find((view) => view.viewId === safeViewId)
      ?? value.views?.find((view) => currentViewName && view.name.trim().toLowerCase() === currentViewName)
      ?? null;
    const matchedMockup = matchedView?.mockupUrl?.trim();
    const optionViewImage = keyedConfig?.mockupUrl?.trim()
      || matchedMockup
      || value.mockupUrls?.[safeViewId]?.trim();
    const finalMockup = optionViewImage || currentView?.mockupUrl?.trim() || '';
    console.log('🔍 [RESOLVER MOCKUP - RESULTADO]:', {
      matchedImage: optionViewImage,
      fallbackImage: currentView?.mockupUrl,
      finalRenderedUrl: finalMockup,
    });
    if (keyedConfig?.mockupUrl?.trim()) {
      return {
        mockupUrl: keyedConfig.mockupUrl.trim(),
        printArea: keyedConfig.printArea ?? defaultPrintArea,
        viewId: safeViewId,
      };
    }
    if (keyedConfig?.printArea) {
      return {
        mockupUrl: currentView?.mockupUrl?.trim() ?? '',
        printArea: keyedConfig.printArea,
        viewId: safeViewId,
      };
    }

    if (matchedMockup) {
      return {
        mockupUrl: matchedMockup,
        printArea: matchedView?.printArea ?? value.printArea ?? defaultPrintArea,
        viewId: safeViewId,
      };
    }

    const perViewMockup = value.mockupUrls?.[safeViewId]?.trim();
    if (perViewMockup) {
      return {
        mockupUrl: perViewMockup,
        printArea: value.printArea ?? defaultPrintArea,
        viewId: safeViewId,
      };
    }

    return null;
  };

  const selectedValues = Object.values(selectedOptions).filter(Boolean);
  for (const value of [...selectedValues].reverse()) {
    const resolved = resolveFromValue(value);
    if (resolved) {
      return resolved;
    }
  }

  const selectedColor = product.colors?.find((color) => color.id === selectedColorId)
    ?? currentView?.colorVariants?.find((variant) => variant.id === selectedColorId);

  const colorSpecificMockup = selectedColor?.mockupUrls?.[safeViewId]?.trim();
  if (colorSpecificMockup) {
    return {
      mockupUrl: colorSpecificMockup,
      printArea: defaultPrintArea,
      viewId: safeViewId,
    };
  }

  const colorDefaultMockup = selectedColor?.mockupUrl?.trim();
  if (colorDefaultMockup) {
    return {
      mockupUrl: colorDefaultMockup,
      printArea: defaultPrintArea,
      viewId: safeViewId,
    };
  }

  return {
    mockupUrl: currentView?.mockupUrl?.trim() ?? '',
    printArea: defaultPrintArea,
    viewId: safeViewId,
  };
}

export default getEffectiveMockup;
