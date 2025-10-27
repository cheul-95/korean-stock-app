export interface StockInfo {
    rt_cd: string;
    msg_cd: string;
    msg1: string;
    stockCode: string;
    stockName: string;
    stockNameEng: string;
    marketType: string;
    sectorCode: string;
    sectorName: string;
    listedShares: string;
    capital: string;
    faceValue: string;
    companyNameKor: string;
    companyNameEng: string;
}
// 주식 현재가 정보
export interface StockPrice {
    rt_cd: string;
    msg_cd: string;
    msg1: string;
    output: {
        iscd_stat_cls_code: string;
        marg_rate: string;
        rprs_mrkt_kor_name: string; // 시장 한글명
        bstp_kor_isnm: string;
        temp_stop_yn: string;
        oprc_rang_cont_yn: string;
        clpr_rang_cont_yn: string;
        crdt_able_yn: string;
        grmn_rate_cls_code: string;
        elw_pblc_yn: string;
        stck_prpr: string; // 주식 현재가
        prdy_vrss: string; // 전일 대비
        prdy_vrss_sign: string; // 전일 대비 부호 (1,2:상승 3:보합 4,5:하락)
        prdy_ctrt: string; // 전일 대비율
        acml_tr_pbmn: string; // 누적 거래 대금
        acml_vol: string; // 누적 거래량
        prdy_vrss_vol_rate: string;
        stck_oprc: string; // 주식 시가
        stck_hgpr: string; // 주식 최고가
        stck_lwpr: string; // 주식 최저가
        stck_mxpr: string; // 주식 상한가
        stck_llam: string; // 주식 하한가
        stck_sdpr: string;
        wghn_avrg_stck_prc: string;
        hts_frgn_ehrt: string;
        frgn_ntby_qty: string; // 외국인 순매수 수량
        pgtr_ntby_qty: string;
        pvt_scnd_dmrs_prc: string;
        pvt_frst_dmrs_prc: string;
        pvt_pont_val: string;
        pvt_frst_dmsp_prc: string;
        pvt_scnd_dmsp_prc: string;
        dmrs_val: string;
        dmsp_val: string;
        cpfn: string;
        rstck_prpr_kor1: string;
        rstck_prpr_kor2: string;
        w52_hgpr: string; // 52주 최고가
        w52_hgpr_date: string;
        w52_lwpr: string; // 52주 최저가
        w52_lwpr_date: string;
        whol_loan_rmnd_rate: string;
        ssts_yn: string;
        stck_shrn_iscd: string;
        fcam_cnnm: string;
        cpfn_cnnm: string;
        frgn_hldn_qty: string;
        vi_cls_code: string;
        ovtm_vi_cls_code: string;
        last_ssts_cntg_qty: string;
        invt_caful_yn: string;
        mrkt_warn_cls_code: string;
        short_over_yn: string;
    };
}

// 호가 정보
export interface AskingPrice {
    rt_cd: string;
    msg_cd: string;
    msg1: string;
    output1: {
        askp_rsqn1: string; // 매도호가 잔량1
        askp_rsqn2: string;
        askp_rsqn3: string;
        askp_rsqn4: string;
        askp_rsqn5: string;
        askp_rsqn6: string;
        askp_rsqn7: string;
        askp_rsqn8: string;
        askp_rsqn9: string;
        askp_rsqn10: string;
        bidp_rsqn1: string; // 매수호가 잔량1
        bidp_rsqn2: string;
        bidp_rsqn3: string;
        bidp_rsqn4: string;
        bidp_rsqn5: string;
        bidp_rsqn6: string;
        bidp_rsqn7: string;
        bidp_rsqn8: string;
        bidp_rsqn9: string;
        bidp_rsqn10: string;
        askp1: string; // 매도호가1
        askp2: string;
        askp3: string;
        askp4: string;
        askp5: string;
        askp6: string;
        askp7: string;
        askp8: string;
        askp9: string;
        askp10: string;
        bidp1: string; // 매수호가1
        bidp2: string;
        bidp3: string;
        bidp4: string;
        bidp5: string;
        bidp6: string;
        bidp7: string;
        bidp8: string;
        bidp9: string;
        bidp10: string;
        total_askp_rsqn: string; // 총 매도호가 잔량
        total_bidp_rsqn: string; // 총 매수호가 잔량
    };
    output2: {
        stck_prpr: string; // 주식 현재가
        prdy_vrss: string; // 전일 대비
        prdy_vrss_sign: string; // 전일 대비 부호
        prdy_ctrt: string; // 전일 대비율
        acml_vol: string; // 누적 거래량
    };
}

// 일별 시세 정보
export interface DailyPrice {
    rt_cd: string;
    msg_cd: string;
    msg1: string;
    output: Array<{
        stck_bsop_date: string; // 주식 영업 일자
        stck_clpr: string; // 주식 종가
        stck_oprc: string; // 주식 시가
        stck_hgpr: string; // 주식 최고가
        stck_lwpr: string; // 주식 최저가
        acml_vol: string; // 누적 거래량
        acml_tr_pbmn: string; // 누적 거래 대금
        flng_cls_code: string;
        prtt_rate: string;
        mod_yn: string;
        prdy_vrss_sign: string;
        prdy_vrss: string;
        revl_issu_reas: string;
    }>;
}

// 인기 종목 정보
export interface PopularStock {
    data_rank: string; // 데이터 순위
    hts_kor_isnm: string; // HTS 한글 종목명
    mksc_shrn_iscd: string; // 유가증권 단축 종목코드
    stck_prpr: string; // 주식 현재가
    prdy_vrss_sign: string; // 전일 대비 부호
    prdy_vrss: string; // 전일 대비
    prdy_ctrt: string; // 전일 대비율
    acml_vol: string; // 누적 거래량
    prdy_vol: string; // 전일 거래량
    lstn_stcn: string; // 상장 주수
    avrg_vol: string; // 평균 거래량
    n_befr_clpr_vrss_prpr_rate: string;
    vol_inrt: string; // 거래량증가율
    vol_tnrt: string; // 거래량회전율
    nday_vol_tnrt: string;
    avrg_tr_pbmn: string; // 평균 거래 대금
    tr_pbmn_tnrt: string;
    nday_tr_pbmn_tnrt: string;
    acml_tr_pbmn: string; // 누적 거래 대금
}

// 검색 결과 타입
export interface SearchStockResult {
    pdno: string; // 종목코드
    prdt_name: string; // 종목명
    prdt_abrv_name: string; // 종목약명
    prdt_eng_name?: string; // 종목영문명
    std_pdno?: string; // 표준종목코드
}

export interface MarketIndex {
    IDX_NM: string; // 지수명
    STCK_PRPR: string; // 현재가
    PRDY_VRSS: string; // 전일대비
    PRDY_VRSS_SIGN: string; // 전일대비부호
    PRDY_CTRT: string; // 전일대비율
    ACML_VOL: string; // 누적거래량
    ACML_TR_PBMN: string; // 누적거래대금
}

export interface MarketIndexes {
    kospi: MarketIndex;
    kosdaq: MarketIndex;
    kospi200: MarketIndex;
}

// 금시세 정보
export interface GoldPrice {
    success: boolean;
    data: {
        goldPricePerGram: number; // 그램당 가격
        goldPricePerDon: number; // 돈당 가격 (3.75g)
        pricePerOunce: number; // 온스당 가격 (원)
        goldPriceUSD: number; // 국제 시세 (달러)
        exchangeRate: number; // 환율
        unit: string; // 단위
        source: string; // 출처
        timestamp: string; // 타임스탬프
    };
}
