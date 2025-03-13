import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// ユーザーエージェント
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stockCode = searchParams.get('code');
  const isUSStockParam = searchParams.get('isUSStock');
  
  // isUSStockパラメータがtrueの場合は米国株として扱う
  const isUSStock = isUSStockParam === 'true';
  
  if (!stockCode) {
    return NextResponse.json({ error: '銘柄コードが指定されていません' }, { status: 400 });
  }

  try {
    // 米国株かどうかを判定
    // 数字のみの場合は日本株として扱う（例: 1698, 7203など）
    const isNumericCode = /^\d+$/.test(stockCode);
    
    // 数字のみの場合は常に日本株として扱う（isUSStockパラメータを無視）
    // それ以外の場合はクライアントから送信されたisUSStockパラメータを使用
    const isUS = isNumericCode ? false : (isUSStock || /^[A-Z]+$/.test(stockCode));
    
    // Yahoo!ファイナンスからデータを取得
    const yahooData = await fetchYahooFinanceData(stockCode, isUS, isNumericCode);
    
    // Googleファイナンスからデータを取得
    const googleData = await fetchGoogleFinanceData(stockCode, isUS, isNumericCode);
    
    // 通貨を決定（数字のみの場合は常にJPY）
    const currency = isNumericCode ? 'JPY' : (isUS ? 'USD' : 'JPY');
    
    return NextResponse.json({
      code: stockCode,
      currency: currency,
      yahoo: yahooData,
      google: googleData
    });
  } catch (error) {
    console.error('株価取得エラー:', error);
    return NextResponse.json({ error: '株価の取得に失敗しました' }, { status: 500 });
  }
}

// Yahoo!ファイナンスからデータを取得する関数
async function fetchYahooFinanceData(stockCode: string, isUSStock: boolean, isNumericCode: boolean) {
  try {
    let price = '未取得';
    let change = '未取得';
    let numericPrice = 0;
    let url = '';
    
    // 数字のみの場合は常に日本株として扱う
    if (isNumericCode || !isUSStock) {
      // 日本株の場合はスクレイピング
      url = `https://finance.yahoo.co.jp/quote/${stockCode}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT
        },
        timeout: 10000 // 10秒タイムアウト
      });
      
      const $ = cheerio.load(response.data);
      
      // 現在値を取得
      const priceText = $('._3rXWJKZF').first().text().trim();
      if (priceText) {
        // カンマを除去して数値に変換
        numericPrice = parseFloat(priceText.replace(/,/g, ''));
        price = `${numericPrice.toLocaleString()}円`;
      }
      
      // 前日比を取得
      const changeText = $('._3rXWJKZF').eq(1).text().trim();
      if (changeText) {
        change = changeText;
      }
    } else {
      // 米国株の場合はスクレイピングに変更（APIが不安定なため）
      try {
        // 簡素化したヘッダーでリクエスト
        url = `https://finance.yahoo.com/quote/${stockCode}`;
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 10000, // 10秒タイムアウト
          maxContentLength: 10 * 1024 * 1024 // 10MB
        });
        
        const $ = cheerio.load(response.data);
        
        // 現在値を取得（fin-streamer要素のdata-valueを探す）
        const priceElement = $('fin-streamer[data-field="regularMarketPrice"]').first();
        if (priceElement.length > 0) {
          const priceValue = priceElement.attr('data-value');
          if (priceValue) {
            numericPrice = parseFloat(priceValue);
            price = `$${numericPrice.toLocaleString()}`;
          }
        }
        
        // 前日比を取得
        const changeElement = $('fin-streamer[data-field="regularMarketChange"]').first();
        const changePercentElement = $('fin-streamer[data-field="regularMarketChangePercent"]').first();
        
        if (changeElement.length > 0 && changePercentElement.length > 0) {
          const changeValue = changeElement.attr('data-value');
          const changePercentValue = changePercentElement.attr('data-value');
          
          if (changeValue && changePercentValue) {
            const changeNum = parseFloat(changeValue);
            const changePercentNum = parseFloat(changePercentValue);
            change = `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)} (${(changePercentNum).toFixed(2)}%)`;
          }
        }
        
        // バックアップ方法: テキストコンテンツから取得
        if (numericPrice === 0) {
          const priceText = $('fin-streamer[data-field="regularMarketPrice"]').text().trim();
          if (priceText) {
            // 重複した価格から最初の価格のみを抽出
            const priceMatch = priceText.match(/\$[\d.,]+/);
            const cleanPriceText = priceMatch ? priceMatch[0] : priceText;
            
            // $記号とカンマを除去して数値に変換
            numericPrice = parseFloat(cleanPriceText.replace(/\$|,/g, ''));
            price = cleanPriceText;
          }
        }
        
        // バックアップ方法2: 他の要素から取得
        if (numericPrice === 0) {
          // 様々なセレクタを試す
          const selectors = [
            '[data-test="qsp-price"]',
            '.Fw(b).Fz(36px)',
            '.Fz(32px)'
          ];
          
          for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
              const text = element.text().trim();
              if (text && /[\d.,]+/.test(text)) {
                // 重複した価格から最初の価格のみを抽出
                const priceMatch = text.match(/\$[\d.,]+/);
                const cleanText = priceMatch ? priceMatch[0] : text;
                
                // 数字、ドット、カンマを含む場合のみ処理
                numericPrice = parseFloat(cleanText.replace(/\$|,/g, ''));
                price = cleanText;
                break;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Yahoo!ファイナンス(米国株)データ取得エラー: ${stockCode}`, error);
        
        // バックアップとしてGoogleファイナンスの値を使用
        try {
          // Googleファイナンスから直接取得
          const googleUrl = `https://www.google.com/finance/quote/${stockCode}:NASDAQ`;
          const googleResponse = await axios.get(googleUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
          });
          
          const $ = cheerio.load(googleResponse.data);
          
          // 現在値を取得
          const priceText = $('.YMlKec.fxKbKc').text().trim();
          if (priceText) {
            // 重複した価格から最初の価格のみを抽出
            const priceMatch = priceText.match(/\$[\d.,]+/);
            const cleanPriceText = priceMatch ? priceMatch[0] : priceText;
            
            // $記号とカンマを除去して数値に変換
            numericPrice = parseFloat(cleanPriceText.replace(/\$|,/g, ''));
            price = cleanPriceText;
          }
        } catch (googleError) {
          console.error(`Googleファイナンス(バックアップ)データ取得エラー: ${stockCode}`, googleError);
          // エラーは無視して続行
        }
      }
    }
    
    return {
      price,
      change,
      numericPrice,
      url
    };
  } catch (error) {
    console.error('Yahoo!ファイナンスデータ取得エラー:', error);
    return {
      price: '未取得',
      change: '未取得',
      numericPrice: 0,
      url: isNumericCode || !isUSStock
        ? `https://finance.yahoo.co.jp/quote/${stockCode}`
        : `https://finance.yahoo.com/quote/${stockCode}`
    };
  }
}

// Googleファイナンスからデータを取得する関数
async function fetchGoogleFinanceData(stockCode: string, isUSStock: boolean, isNumericCode: boolean) {
  try {
    let price = '未取得';
    let change = '未取得';
    let numericPrice = 0;
    let url = '';
    
    // 数字のみの場合は常に日本株として扱う
    if (isNumericCode || !isUSStock) {
      // 日本株の場合
      url = `https://www.google.com/finance/quote/${stockCode}:TYO`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // 現在値を取得
      const priceText = $('.YMlKec.fxKbKc').text().trim();
      if (priceText) {
        // $記号とカンマを除去して数値に変換
        numericPrice = parseFloat(priceText.replace(/\$|,/g, ''));
        price = priceText;
      }
      
      // 前日比を取得
      const changeText = $('.P6K39c').text().trim();
      if (changeText) {
        change = changeText;
      }
    } else {
      // 米国株の場合
      url = `https://www.google.com/finance/quote/${stockCode}:NASDAQ`;
      
      // NASDQで見つからない場合はNYSEを試す
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': USER_AGENT
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // 現在値を取得
        const priceText = $('.YMlKec.fxKbKc').text().trim();
        if (priceText) {
          // 重複した価格から最初の価格のみを抽出
          const priceMatch = priceText.match(/\$[\d.,]+/);
          const cleanPriceText = priceMatch ? priceMatch[0] : priceText;
          
          // $記号とカンマを除去して数値に変換
          numericPrice = parseFloat(cleanPriceText.replace(/\$|,/g, ''));
          price = cleanPriceText;
        }
        
        // 前日比を取得
        const changeText = $('.P6K39c').text().trim();
        if (changeText) {
          // 重複した変化から最初の変化のみを抽出
          const changeMatch = changeText.match(/[\+\-]?\$[\d.,]+/);
          change = changeMatch ? changeMatch[0] : changeText;
        }
      } catch (error) {
        // NASDQで失敗した場合はNYSEを試す
        url = `https://www.google.com/finance/quote/${stockCode}:NYSE`;
        const response = await axios.get(url, {
          headers: {
            'User-Agent': USER_AGENT
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // 現在値を取得
        const priceText = $('.YMlKec.fxKbKc').text().trim();
        if (priceText) {
          // $記号とカンマを除去して数値に変換
          numericPrice = parseFloat(priceText.replace(/\$|,/g, ''));
          price = priceText;
        }
        
        // 前日比を取得
        const changeText = $('.P6K39c').text().trim();
        if (changeText) {
          change = changeText;
        }
      }
    }
    
    return {
      price,
      change,
      numericPrice,
      url
    };
  } catch (error) {
    console.error('Googleファイナンスデータ取得エラー:', error);
    return {
      price: '未取得',
      change: '未取得',
      numericPrice: 0,
      url: isNumericCode || !isUSStock
        ? `https://www.google.com/finance/quote/${stockCode}:TYO`
        : `https://www.google.com/finance/quote/${stockCode}:NASDAQ`
    };
  }
} 