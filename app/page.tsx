'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

// Chart.jsのコンポーネントを登録
ChartJS.register(ArcElement, Tooltip, Legend);

// 株式情報の型定義
interface StockItem {
  id: string;
  code: string;
  shares: number;
  price?: string;
  priceInJPY?: string;
  value?: number;
  currency?: string;
  lastUpdated?: string;
  type: 'stock' | 'fund'; // 株式か投資信託かを区別
  name?: string; // 投資信託の場合は名前を保存
  country: 'JP' | 'US'; // 国の区分（日本か米国か）
}

export default function Home() {
  const [stockCode, setStockCode] = useState('');
  const [shares, setShares] = useState('');
  const [stockData, setStockData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(150); // デフォルト値: 150円/ドル
  const [autoRefresh, setAutoRefresh] = useState(true); // 自動更新の有効/無効
  const [refreshInterval, setRefreshInterval] = useState(10); // 更新間隔（分）
  const [isUSStock, setIsUSStock] = useState(false); // 米国株かどうかのフラグ
  const [isFund, setIsFund] = useState(false); // 投資信託かどうかのフラグ
  const [country, setCountry] = useState<'JP' | 'US'>('JP'); // 国の区分
  
  // 保有株式リスト
  const [stockList, setStockList] = useState<StockItem[]>([]);
  // 合計評価額
  const [totalValue, setTotalValue] = useState(0);
  // 日本株と米国株の合計評価額
  const [jpStockValue, setJpStockValue] = useState(0);
  const [usStockValue, setUsStockValue] = useState(0);
  // 日本と米国の投資信託の合計評価額
  const [jpFundValue, setJpFundValue] = useState(0);
  const [usFundValue, setUsFundValue] = useState(0);
  // 日本と米国の合計投資額
  const [totalJpValue, setTotalJpValue] = useState(0);
  const [totalUsValue, setTotalUsValue] = useState(0);
  // リバランス情報
  const [targetRatio, setTargetRatio] = useState(50); // 目標比率（デフォルト50%）

  // ローカルストレージからデータを読み込む
  useEffect(() => {
    const savedStocks = localStorage.getItem('stockList');
    if (savedStocks) {
      try {
        const parsedStocks = JSON.parse(savedStocks);
        
        // 既存のデータに country フィールドがない場合は追加
        const updatedStocks = parsedStocks.map((stock: any) => {
          if (!stock.country) {
            // 既存のデータから国を推測
            if (stock.type === 'fund') {
              // 投資信託はデフォルトで日本とする
              return { ...stock, country: 'JP' };
            } else {
              // 株式は通貨から判断
              return { ...stock, country: stock.currency === 'USD' ? 'US' : 'JP' };
            }
          }
          
          // 米国株の場合は国の区分を強制的に'US'に設定
          if (stock.currency === 'USD' && stock.country !== 'US') {
            console.log(`${stock.code}の国の区分を'US'に修正します`);
            return { ...stock, country: 'US' };
          }
          
          return stock;
        });
        
        setStockList(updatedStocks);
        console.log('ローカルストレージからデータを読み込みました:', updatedStocks.length + '件');
      } catch (e) {
        console.error('保存データの読み込みエラー:', e);
        localStorage.removeItem('stockList');
      }
    }
    
    // 為替レートの保存データを読み込む
    const savedExchangeRate = localStorage.getItem('exchangeRate');
    if (savedExchangeRate) {
      try {
        setExchangeRate(Number(savedExchangeRate));
      } catch (e) {
        console.error('為替レート読み込みエラー:', e);
      }
    }
    
    // 為替レートを取得
    fetchExchangeRate();
  }, []);

  // 株式リストが変更されたら評価額を更新
  useEffect(() => {
    calculateTotalValue();
    
    // ローカルストレージに保存（株式リストが空でない場合のみ）
    if (stockList.length > 0) {
      localStorage.setItem('stockList', JSON.stringify(stockList));
      console.log('データをローカルストレージに保存しました:', stockList.length + '件');
    }
    
    // 株式リストが更新されたら自動的に株価を取得（初回のみ）
    if (stockList.length > 0 && !stockList.some(stock => stock.price)) {
      updateStockValues();
    }
  }, [stockList]);

  // 為替レートが変更されたら保存
  useEffect(() => {
    localStorage.setItem('exchangeRate', exchangeRate.toString());
  }, [exchangeRate]);

  // 自動更新の設定
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (autoRefresh && stockList.length > 0) {
      console.log(`自動更新を開始: ${refreshInterval}分間隔`);
      // 指定された分間隔で株価を更新（ミリ秒に変換）
      intervalId = setInterval(() => {
        if (!updatingPrices) {
          console.log('定期更新: 株価取得開始');
          updateStockValues();
        } else {
          console.log('前回の更新が完了していないため、スキップします');
        }
      }, refreshInterval * 60 * 1000);
    }
    
    // クリーンアップ関数
    return () => {
      if (intervalId) {
        console.log('自動更新を停止');
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, stockList.length, refreshInterval]); // refreshIntervalを依存配列に追加

  // 自動更新設定の保存
  useEffect(() => {
    localStorage.setItem('autoRefresh', autoRefresh.toString());
    localStorage.setItem('refreshInterval', refreshInterval.toString());
  }, [autoRefresh, refreshInterval]);

  // 初期化時に自動更新設定を読み込む
  useEffect(() => {
    const savedAutoRefresh = localStorage.getItem('autoRefresh');
    if (savedAutoRefresh !== null) {
      setAutoRefresh(savedAutoRefresh === 'true');
    }
    
    const savedRefreshInterval = localStorage.getItem('refreshInterval');
    if (savedRefreshInterval !== null) {
      setRefreshInterval(Number(savedRefreshInterval));
    }
    
    // 目標比率の読み込み
    const savedTargetRatio = localStorage.getItem('targetRatio');
    if (savedTargetRatio !== null) {
      setTargetRatio(Number(savedTargetRatio));
    }
  }, []);

  // 為替レートを取得
  const fetchExchangeRate = async () => {
    try {
      const response = await fetch('/api/exchange');
      const data = await response.json();
      
      if (data.success && data.rate) {
        setExchangeRate(data.rate);
      }
    } catch (err) {
      console.error('為替レート取得エラー:', err);
    }
  };

  // 合計評価額を計算
  const calculateTotalValue = () => {
    if (stockList.length === 0) {
      setTotalValue(0);
      setJpStockValue(0);
      setUsStockValue(0);
      setJpFundValue(0);
      setUsFundValue(0);
      setTotalJpValue(0);
      setTotalUsValue(0);
      return;
    }

    let jpTotal = 0;
    let usTotal = 0;
    let jpFundTotal = 0;
    let usFundTotal = 0;

    console.log('合計評価額計算開始:');
    stockList.forEach(stock => {
      console.log(`${stock.code}: 種別=${stock.type}, 国=${stock.country}, 通貨=${stock.currency}, 評価額=${stock.value || 0}円`);
      
      if (stock.value) {
        if (stock.type === 'fund') {
          if (stock.country === 'US') {
            usFundTotal += stock.value;
            console.log(`  → 米国投資信託に加算: ${stock.value}円`);
          } else {
            jpFundTotal += stock.value;
            console.log(`  → 日本投資信託に加算: ${stock.value}円`);
          }
        } else if (stock.country === 'US') {
          usTotal += stock.value;
          console.log(`  → 米国株に加算: ${stock.value}円`);
        } else {
          jpTotal += stock.value;
          console.log(`  → 日本株に加算: ${stock.value}円`);
        }
      }
    });

    const total = jpTotal + usTotal + jpFundTotal + usFundTotal;
    const totalJp = jpTotal + jpFundTotal;
    const totalUs = usTotal + usFundTotal;
    
    console.log(`日本株合計: ${jpTotal}円`);
    console.log(`米国株合計: ${usTotal}円`);
    console.log(`日本投資信託合計: ${jpFundTotal}円`);
    console.log(`米国投資信託合計: ${usFundTotal}円`);
    console.log(`日本投資合計: ${totalJp}円`);
    console.log(`米国投資合計: ${totalUs}円`);
    console.log(`総合計: ${total}円`);
    
    setJpStockValue(Math.round(jpTotal));
    setUsStockValue(Math.round(usTotal));
    setJpFundValue(Math.round(jpFundTotal));
    setUsFundValue(Math.round(usFundTotal));
    setTotalJpValue(Math.round(totalJp));
    setTotalUsValue(Math.round(totalUs));
    setTotalValue(Math.round(total));
  };

  // 株価を取得して評価額を計算
  const updateStockValues = async () => {
    if (stockList.length === 0) {
      return;
    }

    // 既に更新中の場合は処理をスキップ
    if (updatingPrices) {
      console.log('既に更新中のため、処理をスキップします');
      return;
    }

    setUpdatingPrices(true);
    console.log('株価更新開始: ' + new Date().toLocaleString());
    
    let updatedList = [...stockList];
    
    try {
      // 為替レートを更新（一度だけ）
      await fetchExchangeRate();
      
      for (let i = 0; i < updatedList.length; i++) {
        const stock = updatedList[i];
        // 元の種別情報を保存
        const originalType = stock.type;
        
        try {
          console.log(`${stock.code}の情報を取得中...`);
          
          if (stock.type === 'fund') {
            // 投資信託の場合
            const response = await fetch(`/api/fund?code=${stock.code}`);
            const data = await response.json();
            
            if (response.ok) {
              // 基準価額を取得
              let price = '';
              let numericPrice = 0;
              
              if (data.fund.numericPrice > 0) {
                numericPrice = data.fund.numericPrice;
                price = data.fund.price;
              }
              
              // 評価額計算
              const value = numericPrice * stock.shares;
              
              updatedList[i] = {
                ...stock,
                price: price,
                value: value,
                name: data.fund.name || stock.name,
                currency: 'JPY',
                lastUpdated: new Date().toLocaleString(),
                type: originalType, // 元の種別を明示的に保持
                country: stock.country // 国の区分を保持
              };
            }
          } else {
            // 株式の場合
            // 数字のみの銘柄コードは常に日本株として扱う
            const isNumericCode = /^\d+$/.test(stock.code);
            // 銘柄コードが数字のみの場合はisUSStockパラメータを無視
            const isUS = isNumericCode ? false : (stock.currency === 'USD' || /^[A-Z]+$/.test(stock.code));
            
            console.log(`${stock.code}は米国株か: ${isUS}`);
            
            const response = await fetch(`/api/stock?code=${stock.code}&isUSStock=${isUS}`);
            const data = await response.json();
            
            if (response.ok) {
              // 株価を取得
              let price = '';
              let numericPrice = 0;
              let priceInJPY = '';
              
              // 米国株の場合はGoogleファイナンスの株価を優先的に使用
              if (data.currency === 'USD' && data.google.numericPrice > 0) {
                numericPrice = data.google.numericPrice;
                price = data.google.price;
                
                // 価格が重複している場合は最初の価格のみを使用
                if (price && price.includes('$') && price.indexOf('$', price.indexOf('$') + 1) > 0) {
                  const match = price.match(/\$[\d.,]+/);
                  if (match) {
                    price = match[0];
                  }
                }
              } 
              // 日本株またはGoogleで取得できなかった場合はYahoo!の株価を使用
              else if (data.yahoo.numericPrice > 0) {
                numericPrice = data.yahoo.numericPrice;
                price = data.yahoo.price;
                
                // 価格が重複している場合は最初の価格のみを使用
                if (price && price.includes('$') && price.indexOf('$', price.indexOf('$') + 1) > 0) {
                  const match = price.match(/\$[\d.,]+/);
                  if (match) {
                    price = match[0];
                  }
                }
              } 
              // Yahoo!で取得できなかった場合はGoogleの株価を使用（日本株の場合）
              else if (data.google.numericPrice > 0) {
                numericPrice = data.google.numericPrice;
                price = data.google.price;
                
                // 価格が重複している場合は最初の価格のみを使用
                if (price && price.includes('$') && price.indexOf('$', price.indexOf('$') + 1) > 0) {
                  const match = price.match(/\$[\d.,]+/);
                  if (match) {
                    price = match[0];
                  }
                }
              }
              
              // 通貨に応じた評価額計算
              let value = 0;
              let country: 'JP' | 'US' = 'JP';
              
              if (data.currency === 'USD') {
                // 米国株の場合は円換算
                value = numericPrice * stock.shares * exchangeRate;
                priceInJPY = numericPrice > 0 ? `${numericPrice.toLocaleString()} ドル (${(numericPrice * exchangeRate).toLocaleString()} 円)` : '未取得';
                country = 'US'; // 米国株の場合は国の区分を'US'に設定
              } else {
                // 日本株の場合はそのまま
                value = numericPrice * stock.shares;
                priceInJPY = '';
                country = 'JP'; // 日本株の場合は国の区分を'JP'に設定
              }
              
              console.log(`${stock.code}の通貨: ${data.currency}, 国の区分: ${country}, 評価額: ${value}円`);
              
              updatedList[i] = {
                ...stock,
                price: price,
                priceInJPY: priceInJPY,
                value: value,
                currency: data.currency,
                lastUpdated: new Date().toLocaleString(),
                type: originalType, // 元の種別を明示的に保持
                country: country // 通貨に基づいて国の区分を設定
              };
            }
          }
        } catch (err) {
          console.error(`情報取得エラー (${stock.code}):`, err);
        }
        
        // 各リクエスト間に少し遅延を入れる
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setStockList(updatedList);
      console.log('情報更新完了: ' + new Date().toLocaleString());
      
      // 更新後に合計評価額を再計算（タイムアウトを長くして確実に反映されるようにする）
      setTimeout(() => {
        calculateTotalValue();
        console.log('合計評価額再計算完了');
        
        // 再計算後にUIを強制的に更新
        setTotalValue(prev => {
          console.log('合計評価額を強制更新:', prev);
          return prev;
        });
      }, 1000);
    } finally {
      setUpdatingPrices(false);
    }
  };

  // 株式を追加
  const addStock = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stockCode.trim()) {
      setError('銘柄コードを入力してください');
      return;
    }
    
    if (!shares.trim() || isNaN(Number(shares)) || Number(shares) <= 0) {
      setError('有効な所有数を入力してください');
      return;
    }
    
    // 既存の銘柄かチェック
    const existingIndex = stockList.findIndex(item => item.code.toLowerCase() === stockCode.trim().toLowerCase());
    
    if (existingIndex >= 0) {
      // 既存の銘柄の場合は所有数を更新
      const updatedList = [...stockList];
      updatedList[existingIndex].shares = Number(shares);
      setStockList(updatedList);
    } else {
      // 米国株かどうかを判定
      const isNumericCode = /^\d+$/.test(stockCode.trim());
      const isUS = isNumericCode ? false : (isUSStock || /^[A-Z]+$/.test(stockCode.trim()));
      
      // 新しい銘柄を追加
      setStockList([
        ...stockList,
        {
          id: Date.now().toString(),
          code: stockCode.trim(),
          shares: Number(shares),
          currency: isFund ? 'JPY' : (isUS ? 'USD' : 'JPY'), // 通貨情報を追加
          type: isFund ? 'fund' : 'stock', // 種別を追加
          name: isFund ? '投資信託' : undefined, // 投資信託の場合は名前を保存
          country: isFund ? country : (isUS ? 'US' : 'JP') // 国の区分を追加（米国株の場合は'US'）
        }
      ]);
    }
    
    // フォームをリセット（種別はそのまま）
    setStockCode('');
    setShares('');
    setError('');
    // 種別選択（isFund, isUSStock）はリセットしない
  };

  // 株式を削除
  const removeStock = (id: string) => {
    setStockList(stockList.filter(item => item.id !== id));
  };

  // 株価を検索
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stockCode.trim()) {
      setError('銘柄コードを入力してください');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      if (isFund) {
        // 投資信託の場合
        const response = await fetch(`/api/fund?code=${stockCode.trim()}`);
        const data = await response.json();
        
        if (response.ok) {
          setStockData(data);
        } else {
          setError(data.error || '投資信託情報の取得に失敗しました');
          setStockData(null);
        }
      } else {
        // 株式の場合
        // 数字のみの銘柄コードは常に日本株として扱う
        const isNumericCode = /^\d+$/.test(stockCode.trim());
        // 銘柄コードが数字のみの場合はisUSStockパラメータを無視
        const isUS = isNumericCode ? false : isUSStock;
        
        const response = await fetch(`/api/stock?code=${stockCode.trim()}&isUSStock=${isUS}`);
        const data = await response.json();
        
        if (response.ok) {
          // 米国株の場合は円換算情報を追加
          if (data.currency === 'USD') {
            // Yahoo!ファイナンスの株価を使用
            if (data.yahoo.numericPrice > 0) {
              const priceInJPY = data.yahoo.numericPrice * exchangeRate;
              data.yahoo.priceInJPY = `${priceInJPY.toLocaleString()} 円`;
            }
            
            // Googleファイナンスの株価を使用
            if (data.google.numericPrice > 0) {
              const priceInJPY = data.google.numericPrice * exchangeRate;
              data.google.priceInJPY = `${priceInJPY.toLocaleString()} 円`;
            }
            
            data.exchangeRate = exchangeRate;
          }
          
          setStockData(data);
        } else {
          setError(data.error || '株価の取得に失敗しました');
          setStockData(null);
        }
      }
    } catch (err) {
      setError('情報の取得中にエラーが発生しました');
      setStockData(null);
    } finally {
      setLoading(false);
    }
  };

  // 株価を更新
  const refreshStockValues = () => {
    updateStockValues();
  };

  // 自動更新の切り替え
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // 更新間隔の変更
  const changeRefreshInterval = (minutes: number) => {
    setRefreshInterval(minutes);
    // 自動更新が無効の場合は有効にする
    if (!autoRefresh) {
      setAutoRefresh(true);
    }
  };

  // 目標比率が変更されたら保存
  useEffect(() => {
    localStorage.setItem('targetRatio', targetRatio.toString());
  }, [targetRatio]);

  return (
    <div className="min-h-screen p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">株価・投資信託チェッカー</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Yahoo!ファイナンスとGoogleファイナンスから株価・投資信託情報を取得します
        </p>
        <p className="text-sm text-gray-500 mt-1">
          為替レート: 1ドル = {exchangeRate.toLocaleString()} 円
        </p>
      </header>

      <main className="w-full max-w-4xl flex flex-col items-center">
        {/* 株式登録フォーム */}
        <form onSubmit={addStock} className="w-full max-w-md mb-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">銘柄を登録</h2>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">種別選択:</span>
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio h-4 w-4 text-blue-600"
                      checked={!isFund && !isUSStock}
                      onChange={() => {
                        setIsFund(false);
                        setIsUSStock(false);
                        setCountry('JP');
                      }}
                    />
                    <span className="ml-2">日本株</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio h-4 w-4 text-blue-600"
                      checked={!isFund && isUSStock}
                      onChange={() => {
                        setIsFund(false);
                        setIsUSStock(true);
                        setCountry('US');
                      }}
                    />
                    <span className="ml-2">米国株</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio h-4 w-4 text-green-600"
                      checked={isFund}
                      onChange={() => {
                        setIsFund(true);
                        setIsUSStock(false);
                      }}
                    />
                    <span className="ml-2">投資信託</span>
                  </label>
                </div>
              </div>
              
              {/* 投資信託の場合は国の選択肢を表示 */}
              {isFund && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">分類:</span>
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-blue-600"
                        checked={country === 'JP'}
                        onChange={() => setCountry('JP')}
                      />
                      <span className="ml-2">日本</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-blue-600"
                        checked={country === 'US'}
                        onChange={() => setCountry('US')}
                      />
                      <span className="ml-2">米国</span>
                    </label>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="stockCode" className="block text-sm font-medium mb-1">
                    {isFund ? '投資信託コード' : '銘柄コード'} 
                    {isUSStock && <span className="text-xs text-blue-600">（米国株）</span>}
                    {isFund && <span className="text-xs text-green-600">（投資信託）</span>}
                  </label>
                  <input
                    type="text"
                    id="stockCode"
                    value={stockCode}
                    onChange={(e) => setStockCode(e.target.value)}
                    placeholder={isFund ? "例: 64311081" : isUSStock ? "例: AAPL" : "例: 7203"}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                  />
                </div>
                
                <div>
                  <label htmlFor="shares" className="block text-sm font-medium mb-1">
                    {isFund ? '口数' : '所有数'}
                  </label>
                  <input
                    type="number"
                    id="shares"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="例: 100"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                登録
              </button>
              
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                情報検索
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
                {error}
              </div>
            )}
          </div>
        </form>

        {/* 保有銘柄リスト */}
        <div className="w-full mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">保有銘柄リスト</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <label htmlFor="autoRefresh" className="mr-2 text-sm">
                  自動更新:
                </label>
                <button
                  id="autoRefresh"
                  onClick={toggleAutoRefresh}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    autoRefresh ? 'bg-green-600' : 'bg-gray-400'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* 更新間隔選択 */}
              <div className="relative">
                <select
                  value={refreshInterval}
                  onChange={(e) => changeRefreshInterval(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
                  disabled={!autoRefresh}
                >
                  <option value="1">1分</option>
                  <option value="5">5分</option>
                  <option value="10">10分</option>
                  <option value="15">15分</option>
                  <option value="30">30分</option>
                </select>
              </div>
              
              <button
                onClick={refreshStockValues}
                disabled={updatingPrices}
                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm disabled:opacity-50"
              >
                {updatingPrices ? '更新中...' : '価格更新'}
              </button>
            </div>
          </div>
          
          {stockList.length === 0 ? (
            <p className="text-gray-500 text-center py-4">登録された銘柄はありません</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="px-4 py-2 text-left">コード</th>
                      <th className="px-4 py-2 text-left">種別</th>
                      <th className="px-4 py-2 text-left">名前</th>
                      <th className="px-4 py-2 text-right">所有数/口数</th>
                      <th className="px-4 py-2 text-right">価格</th>
                      <th className="px-4 py-2 text-right">評価額</th>
                      <th className="px-4 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockList.map((stock) => (
                      <tr key={stock.id} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-3">
                          {stock.code}
                          {stock.currency === 'USD' && <span className="ml-1 text-xs text-blue-600">USD</span>}
                        </td>
                        <td className="px-4 py-3">
                          {stock.type === 'fund' ? 
                            <span className="text-green-600">投資信託</span> : 
                            stock.currency === 'USD' ? 
                              <span className="text-blue-600">米国株</span> : 
                              <span>日本株</span>
                          }
                          {stock.type === 'fund' && (
                            <span className="ml-1 text-xs">
                              {stock.country === 'US' ? '(米国)' : '(日本)'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {stock.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">{stock.shares.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {stock.price || '未取得'}
                          {stock.priceInJPY && (
                            <div className="text-xs text-gray-500">{stock.priceInJPY}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {stock.value 
                            ? Math.round(stock.value).toLocaleString() + '円' 
                            : '未取得'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeStock(stock.id)}
                            className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-right">
                最終更新: {stockList.some(s => s.lastUpdated) ? 
                  stockList.filter(s => s.lastUpdated).sort((a, b) => 
                    (b.lastUpdated || '').localeCompare(a.lastUpdated || '')
                  )[0].lastUpdated : '未更新'}
              </p>
              
              {/* 投資額サマリー */}
              {totalValue > 0 && (
                <div className="mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">投資額サマリー</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-300">合計投資額</div>
                      <div className="text-2xl font-bold mt-1">{totalValue.toLocaleString()}円</div>
                      <div className="text-sm mt-1">100%</div>
                    </div>
                    
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-300">日本投資額</div>
                      <div className="text-2xl font-bold mt-1">
                        {totalJpValue.toLocaleString()}円
                      </div>
                      <div className="text-sm mt-1">
                        {Math.round((totalJpValue / totalValue) * 100)}%
                      </div>
                    </div>
                    
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-300">米国投資額</div>
                      <div className="text-2xl font-bold mt-1">
                        {totalUsValue.toLocaleString()}円
                      </div>
                      <div className="text-sm mt-1">
                        {Math.round((totalUsValue / totalValue) * 100)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* リバランス設定 */}
                  <div className="mt-6">
                    <h4 className="text-md font-semibold mb-2">リバランス設定</h4>
                    <div className="flex items-center mb-4">
                      <div className="mr-4">
                        <span className="text-sm text-gray-600 dark:text-gray-300">目標比率: </span>
                        <span className="font-semibold">日本 {targetRatio}% : 米国 {100 - targetRatio}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={targetRatio} 
                        onChange={(e) => setTargetRatio(Number(e.target.value))}
                        className="w-40 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    
                    {/* リバランス計算結果 */}
                    {totalValue > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                        <h5 className="font-semibold mb-2">リバランス分析</h5>
                        
                        {(() => {
                          // 現在の比率
                          const currentJpRatio = totalJpValue / totalValue * 100;
                          const currentUsRatio = totalUsValue / totalValue * 100;
                          
                          // 目標金額
                          const targetJpAmount = totalValue * (targetRatio / 100);
                          const targetUsAmount = totalValue * ((100 - targetRatio) / 100);
                          
                          // 差額
                          const jpDifference = targetJpAmount - totalJpValue;
                          const usDifference = targetUsAmount - totalUsValue;
                          
                          return (
                            <div>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <div className="text-sm">日本投資（現在）</div>
                                  <div className="font-semibold">{totalJpValue.toLocaleString()}円 ({Math.round(currentJpRatio)}%)</div>
                                </div>
                                <div>
                                  <div className="text-sm">米国投資（現在）</div>
                                  <div className="font-semibold">{totalUsValue.toLocaleString()}円 ({Math.round(currentUsRatio)}%)</div>
                                </div>
                                <div>
                                  <div className="text-sm">日本投資（目標）</div>
                                  <div className="font-semibold">{Math.round(targetJpAmount).toLocaleString()}円 ({targetRatio}%)</div>
                                </div>
                                <div>
                                  <div className="text-sm">米国投資（目標）</div>
                                  <div className="font-semibold">{Math.round(targetUsAmount).toLocaleString()}円 ({100 - targetRatio}%)</div>
                                </div>
                              </div>
                              
                              <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
                                <h6 className="font-semibold mb-2">リバランス推奨アクション</h6>
                                {Math.abs(jpDifference) < 10000 && Math.abs(usDifference) < 10000 ? (
                                  <p className="text-green-600 dark:text-green-400">現在のポートフォリオは目標比率に近いため、リバランス不要です。</p>
                                ) : (
                                  <div>
                                    {jpDifference > 10000 && (
                                      <p className="mb-2">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">日本投資を{Math.round(jpDifference).toLocaleString()}円分追加</span>してください。
                                      </p>
                                    )}
                                    {jpDifference < -10000 && (
                                      <p className="mb-2">
                                        <span className="font-semibold text-gray-600">日本投資が{Math.abs(Math.round(jpDifference)).toLocaleString()}円分過剰</span>です。
                                      </p>
                                    )}
                                    {usDifference > 10000 && (
                                      <p className="mb-2">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">米国投資を{Math.round(usDifference).toLocaleString()}円分追加</span>してください。
                                      </p>
                                    )}
                                    {usDifference < -10000 && (
                                      <p className="mb-2">
                                        <span className="font-semibold text-gray-600">米国投資が{Math.abs(Math.round(usDifference)).toLocaleString()}円分過剰</span>です。
                                      </p>
                                    )}
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                      ※ 売却せずに不足分を購入することでリバランスを行います。
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 円グラフの追加 */}
              {totalValue > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">ポートフォリオ構成</h3>
                  <div className="flex justify-center" style={{ height: '300px' }}>
                    <Pie
                      data={{
                        labels: ['日本株', '米国株', '日本の投資信託', '米国の投資信託'],
                        datasets: [
                          {
                            data: [
                              jpStockValue, 
                              usStockValue,
                              stockList
                                .filter(stock => stock.type === 'fund' && stock.country === 'JP')
                                .reduce((sum, stock) => sum + (stock.value || 0), 0),
                              stockList
                                .filter(stock => stock.type === 'fund' && stock.country === 'US')
                                .reduce((sum, stock) => sum + (stock.value || 0), 0)
                            ],
                            backgroundColor: [
                              'rgba(255, 99, 132, 0.6)',
                              'rgba(54, 162, 235, 0.6)',
                              'rgba(75, 192, 192, 0.6)',
                              'rgba(153, 102, 255, 0.6)'
                            ],
                            borderColor: [
                              'rgba(255, 99, 132, 1)',
                              'rgba(54, 162, 235, 1)',
                              'rgba(75, 192, 192, 1)',
                              'rgba(153, 102, 255, 1)'
                            ],
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              font: {
                                size: 14
                              }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw;
                                const percentage = Math.round((Number(value) / totalValue) * 100);
                                return `${context.label}: ${Number(value).toLocaleString()}円 (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 株価検索結果 */}
        {stockData && (
          <div className="w-full">
            <h2 className="text-xl font-semibold mb-4">
              {stockData.code} の情報
              {stockData.currency === 'USD' && <span className="ml-2 text-sm text-blue-600">米国株 (USD)</span>}
              {stockData.fund && <span className="ml-2 text-sm text-green-600">投資信託</span>}
            </h2>
            
            {stockData.fund ? (
              // 投資信託の情報表示
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">{stockData.fund.name}</h3>
                  <a
                    href={stockData.fund.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    詳細を見る →
                  </a>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">基準価額:</span>
                    <span className="ml-2 text-xl font-bold">{stockData.fund.price}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">前日比:</span>
                    <span className="ml-2">{stockData.fund.change}</span>
                    {stockData.fund.changePercent && (
                      <span className="ml-2">({stockData.fund.changePercent})</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // 株式の情報表示
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Yahoo!ファイナンス</h3>
                    <a
                      href={stockData.yahoo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      詳細を見る →
                    </a>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">現在値:</span>
                      <span className="ml-2 text-xl font-bold">{stockData.yahoo.price}</span>
                      {stockData.yahoo.priceInJPY && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 ml-2">
                          円換算: {stockData.yahoo.priceInJPY}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">前日比:</span>
                      <span className="ml-2">{stockData.yahoo.change}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Googleファイナンス</h3>
                    <a
                      href={stockData.google.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      詳細を見る →
                    </a>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">現在値:</span>
                      <span className="ml-2 text-xl font-bold">{stockData.google.price}</span>
                      {stockData.google.priceInJPY && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 ml-2">
                          円換算: {stockData.google.priceInJPY}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">前日比:</span>
                      <span className="ml-2">{stockData.google.change}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {stockData.currency === 'USD' && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-md text-sm">
                <p>為替レート: 1ドル = {stockData.exchangeRate?.toLocaleString() || exchangeRate.toLocaleString()} 円</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto pt-8 pb-4 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} 株価チェッカー - Next.jsで作成</p>
      </footer>
    </div>
  );
}


