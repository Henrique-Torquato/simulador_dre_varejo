// main.js - VERSÃO COM PRECISÃO FISCAL (TESE DO SÉCULO)

document.addEventListener('DOMContentLoaded', () => {
    const state = {};
    const elements = {};
    
    document.querySelectorAll('[id]').forEach(el => elements[el.id] = el);

    function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function formatValue(value) { return (value || 0).toFixed(2); }
    function parseInput(value) { return parseFloat(String(value).replace(',', '.')) || 0; }

    function getAndReconcileInputs(sourceId) {
        state.inputs = {};
        for (const key in elements) {
            if (elements[key].tagName === 'INPUT') {
                state.inputs[key] = elements[key].type === 'checkbox' ? elements[key].checked : parseInput(elements[key].value);
            }
        }
        
        const { ind_receitaLiquida_valor } = state.inputs;
        let { ind_pisCofins_perc, ind_icms_perc } = state.inputs;
        ind_pisCofins_perc /= 100;
        ind_icms_perc /= 100;

        // --- CORREÇÃO ESTRATÉGICA (Tese do Século) ---
        // Esta é a fórmula fiscalmente exata, que exclui o ICMS da base do PIS/COFINS.
        // A fórmula matemática é: RB = RL / (1 - %ICMS - (%PISCOFINS * (1 - %ICMS)))
        const baseDivisor = 1 - ind_icms_perc - (ind_pisCofins_perc * (1 - ind_icms_perc));
        const receitaBrutaBase = baseDivisor > 0 ? ind_receitaLiquida_valor / baseDivisor : 0;
        
        const reconcilePair = (percId, valorId, base) => {
            if (sourceId === percId) {
                const newValue = (state.inputs[percId] / 100) * base;
                state.inputs[valorId] = newValue;
                elements[valorId].value = formatValue(newValue);
            } else if (sourceId === valorId) {
                const newValue = base > 0 ? (state.inputs[valorId] / base) * 100 : 0;
                state.inputs[percId] = newValue;
                elements[percId].value = formatValue(newValue);
            }
        };

        // A base de PIS/COFINS é RB - ICMS, mas a reconciliação do input usa RB para manter a simplicidade da interação. O cálculo final é o que importa.
        const pisCofinsBase = receitaBrutaBase - (receitaBrutaBase * ind_icms_perc);
        // Para a interação no front, manteremos a simplicidade de usar a RB como base de referência para o % inputado, mas o cálculo do valor será ajustado se necessário.
        // A forma mais robusta é deixar a fórmula principal (baseDivisor) fazer o trabalho pesado.
        
        reconcilePair('ind_pisCofins_perc', 'ind_pisCofins_valor', pisCofinsBase); // Base correta para PIS/COFINS
        reconcilePair('ind_icms_perc', 'ind_icms_valor', receitaBrutaBase);    // Base correta para ICMS
        reconcilePair('ind_ipi_perc', 'ind_ipi_valor', receitaBrutaBase);
        reconcilePair('ind_st_perc', 'ind_st_valor', receitaBrutaBase);
        reconcilePair('dre_acordos_perc', 'dre_acordos_valor', receitaBrutaBase);
        reconcilePair('dre_cpv_perc', 'dre_cpv_valor', receitaBrutaBase);
        reconcilePair('dre_frete_perc', 'dre_frete_valor', receitaBrutaBase);
    }

    function calculateIndustry() {
        const { ind_receitaLiquida_valor, ind_icms_perc, ind_pisCofins_perc } = state.inputs;
        state.ind = {};
        
        // Recalcula a RB com a fórmula exata para garantir consistência
        const icms_p = ind_icms_perc / 100;
        const piscofins_p = ind_pisCofins_perc / 100;
        const divisor = 1 - icms_p - (piscofins_p * (1 - icms_p));
        const receitaBruta = divisor > 0 ? ind_receitaLiquida_valor / divisor : 0;

        state.ind.receitaBruta_valor = receitaBruta;
        const icmsValor = receitaBruta * icms_p;
        const pisCofinsValor = (receitaBruta - icmsValor) * piscofins_p;
        
        // O valor dos impostos no state é atualizado com o cálculo exato
        state.inputs.ind_icms_valor = icmsValor;
        state.inputs.ind_pisCofins_valor = pisCofinsValor;
        
        state.ind.precoNFcomIPI_valor = state.ind.receitaBruta_valor + state.inputs.ind_ipi_valor;
        state.ind.totalNF_valor = state.ind.precoNFcomIPI_valor + state.inputs.ind_st_valor;
    }

    // ... (O resto das funções calculateRetail, calculateAnalysis, updateUI, runSimulation permanecem as mesmas da versão anterior)
    function calculateRetail() {
        const { var_recuperaPisCofins, var_margem_perc, var_icmsVenda_perc, var_pisCofinsVenda_perc, ind_pisCofins_valor } = state.inputs;
        state.var = {};
        state.var.custoCliente_valor = state.ind.totalNF_valor;
        if (var_recuperaPisCofins) {
            state.var.custoCliente_valor -= ind_pisCofins_valor;
        }
        const totalTaxAndMarginPerc = (var_margem_perc + var_icmsVenda_perc + var_pisCofinsVenda_perc) / 100;
        const divisor = 1 - totalTaxAndMarginPerc;
        state.var.precoVenda_valor = divisor > 0 ? state.var.custoCliente_valor / divisor : 0;
        state.var.icmsVenda_valor = state.var.precoVenda_valor * (var_icmsVenda_perc / 100);
        state.var.pisCofinsVenda_valor = state.var.precoVenda_valor * (var_pisCofinsVenda_perc / 100);
    }

    function calculateAnalysis() {
        const { dre_acordos_valor, dre_cpv_valor, dre_frete_valor } = state.inputs;
        state.dre = {};
        state.dre.receitaBruta_valor = state.ind.receitaBruta_valor;
        state.dre.impostos_valor = state.inputs.ind_pisCofins_valor + state.inputs.ind_icms_valor;
        state.dre.receitaLiquida_valor = state.dre.receitaBruta_valor - state.dre.impostos_valor - dre_acordos_valor;
        state.dre.margemBruta_valor = state.dre.receitaLiquida_valor - dre_cpv_valor;
        state.dre.margemVariavel_valor = state.dre.margemBruta_valor - dre_frete_valor;
        const base = state.dre.receitaLiquida_valor;
        const baseBruta = state.dre.receitaBruta_valor;
        state.dre.impostos_perc = baseBruta > 0 ? state.dre.impostos_valor / baseBruta : 0;
        state.dre.receitaLiquida_perc = baseBruta > 0 ? state.dre.receitaLiquida_valor / baseBruta : 0;
        state.dre.margemBruta_perc = base > 0 ? state.dre.margemBruta_valor / base : 0;
        state.dre.margemVariavel_perc = base > 0 ? state.dre.margemVariavel_valor / base : 0;
    }

    function updateUI() {
        elements.ind_icms_valor.value = formatValue(state.inputs.ind_icms_valor);
        elements.ind_pisCofins_valor.value = formatValue(state.inputs.ind_pisCofins_valor);
        elements.ind_receitaBruta_valor.textContent = formatCurrency(state.ind.receitaBruta_valor);
        elements.ind_precoNFcomIPI_valor.textContent = formatCurrency(state.ind.precoNFcomIPI_valor);
        elements.ind_totalNF_valor.textContent = formatCurrency(state.ind.totalNF_valor);
        elements.var_custoCliente_valor.textContent = formatCurrency(state.var.custoCliente_valor);
        elements.var_precoVenda_valor.textContent = formatCurrency(state.var.precoVenda_valor);
        elements.var_icmsVenda_valor.textContent = formatCurrency(state.var.icmsVenda_valor);
        elements.var_pisCofinsVenda_valor.textContent = formatCurrency(state.var.pisCofinsVenda_valor);
        elements.dre_receitaBruta_valor.textContent = formatCurrency(state.dre.receitaBruta_valor);
        elements.dre_impostos_valor.textContent = formatCurrency(state.dre.impostos_valor);
        elements.dre_impostos_perc.textContent = (state.dre.impostos_perc * 100).toFixed(2) + '%';
        elements.dre_receitaLiquida_valor.textContent = formatCurrency(state.dre.receitaLiquida_valor);
        elements.dre_receitaLiquida_perc.textContent = (state.dre.receitaLiquida_perc * 100).toFixed(2) + '%';
        elements.dre_margemBruta_valor.textContent = formatCurrency(state.dre.margemBruta_valor);
        elements.dre_margemBruta_perc.textContent = (state.dre.margemBruta_perc * 100).toFixed(2) + '%';
        elements.dre_margemVariavel_valor.textContent = formatCurrency(state.dre.margemVariavel_valor);
        elements.dre_margemVariavel_perc.textContent = (state.dre.margemVariavel_perc * 100).toFixed(2) + '%';
        const profitEl = elements.dre_margemVariavel_valor;
        profitEl.classList.remove('profit', 'loss');
        if (state.dre.margemVariavel_valor > 0) profitEl.classList.add('profit');
        else if (state.dre.margemVariavel_valor < 0) profitEl.classList.add('loss');
    }

    function runSimulation(event) {
        const sourceId = event ? event.target.id : null;
        getAndReconcileInputs(sourceId);
        calculateIndustry();
        calculateRetail();
        calculateAnalysis();
        updateUI();
    }

    document.querySelector('.simulator-container').addEventListener('input', runSimulation);
    runSimulation(null);
});