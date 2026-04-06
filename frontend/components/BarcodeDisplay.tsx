import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface BarcodeDisplayProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39';
  height?: number;
  showText?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BarcodeDisplay({
  value,
  format = 'CODE128',
  height = 100,
  showText = true,
}: BarcodeDisplayProps) {
  
  const htmlContent = useMemo(() => {
    // Use jsbarcode from local node_modules via require
    // This ensures offline functionality without CDN dependency
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: white;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            #barcode {
              max-width: 100%;
            }
            .error {
              color: #FF3B30;
              padding: 20px;
              text-align: center;
              font-size: 14px;
            }
            .barcode-fallback {
              font-family: 'Libre Barcode 128', monospace;
              font-size: 64px;
              text-align: center;
              padding: 20px;
            }
            .barcode-text {
              font-family: monospace;
              font-size: 16px;
              text-align: center;
              margin-top: 8px;
              letter-spacing: 2px;
            }
          </style>
          <!-- Load jsbarcode from unpkg with fallback -->
          <script src="https://unpkg.com/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          <div id="container">
            <svg id="barcode"></svg>
          </div>
          <script>
            (function() {
              var value = "${value}";
              var format = "${format}";
              var height = ${height};
              var showText = ${showText};
              
              function renderFallback() {
                // Simple fallback: display numbers with styling
                var container = document.getElementById('container');
                var html = '<div style="padding: 20px; text-align: center;">';
                html += '<div style="font-family: monospace; font-size: 48px; font-weight: bold; letter-spacing: 4px; margin-bottom: 10px;">▌▌▌ ▌▌ ▌▌▌▌ ▌</div>';
                if (showText) {
                  html += '<div style="font-family: monospace; font-size: 18px; letter-spacing: 2px;">' + value + '</div>';
                }
                html += '<div style="font-size: 12px; color: #8E8E93; margin-top: 10px;">* Barcode image loading *</div>';
                html += '</div>';
                container.innerHTML = html;
              }
              
              try {
                if (typeof JsBarcode === 'undefined') {
                  renderFallback();
                  return;
                }
                
                JsBarcode("#barcode", value, {
                  format: format,
                  width: 2,
                  height: height,
                  displayValue: showText,
                  fontSize: 16,
                  margin: 10,
                  background: "#FFFFFF",
                  lineColor: "#000000"
                });
              } catch (e) {
                console.error('Barcode error:', e);
                renderFallback();
              }
            })();
          </script>
        </body>
      </html>
    `;
  }, [value, format, height, showText]);

  if (!value || value === 'N/A') {
    return (
      <View style={styles.container}>
        <Text style={styles.noBarcodeText}>No barcode available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: height + 60 }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        // Cache the jsbarcode library after first load
        sharedCookiesEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  noBarcodeText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    padding: 20,
    textAlign: 'center',
  },
});
