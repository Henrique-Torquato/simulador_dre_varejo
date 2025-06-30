// main.js - Matriz RGM Estratégica v2.0
// Autor: Henrique Paulo Torquato Amorim [cite: 1]
// Analista Estratégico: INatto Insights

document.addEventListener('DOMContentLoaded', () => {
    /**
     * Objeto de Estado Global: Armazena todos os resultados dos cálculos
     * para que possam ser compartilhados entre as diferentes visões da ferramenta.
     * É a nossa "única fonte da verdade".
     */
    const state = {
        inputs: {},
        ind: {}, // Resultados da Indústria
        var: {}, // Resultados do Varejo (Buildup)
        dre: {}  // Resultados da DRE (Buildup)
    };

    // Mapeamento de todos os elementos do DOM que possuem um ID para acesso rápido.
    const elements = {};
    document.querySelectorAll('[id]').forEach(el => elements[el.id] = el);

    // =================================================================================
    // FUNÇÕES UTILITÁRIAS
    // =================================================================================

    function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function formatValue(value) { return (value || 0).toFixed(2); }
    function parseInput(value) { return parseFloat(String(value).replace(',', '.')) || 0; }

    // =================================================================================
    // LÓGICA DE NAVEGAÇÃO ENTRE VISÕES
    // =================================================================================
    
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = e.target.getAttribute('data-view');

            // Atualiza o estado visual da navegação
            navLinks.forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');

            // Alterna a visão ativa
            views.forEach(v => v.classList.remove('active-view'));
            document.getElementById(`view-${viewId}`).classList.add('active-view');

            // Se o usuário mudar para a visão de "Breakdown", atualiza os cálculos dela.
            if (viewId === 'breakdown') {
                runReverseSimulation();
            }
        });
    });

    // =================================================================================
    // VISÃO 1: SIMULAÇÃO DE PREÇO (BUILDUP) - LÓGICA ORIGINAL
    // =================================================================================

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

        const pisCofinsBase = receitaBrutaBase - (receitaBrutaBase * ind_icms_perc);
        reconcilePair('ind_pisCofins_perc', 'ind_pisCofins_valor', pisCofinsBase);
        reconcilePair('ind_icms_perc', 'ind_icms_valor', receitaBrutaBase);
        reconcilePair('ind_ipi_perc', 'ind_ipi_valor', receitaBrutaBase);
        reconcilePair('ind_st_perc', 'ind_st_valor', receitaBrutaBase);
        reconcilePair('dre_acordos_perc', 'dre_acordos_valor', receitaBrutaBase);
        reconcilePair('dre_cpv_perc', 'dre_cpv_valor', receitaBrutaBase);
        reconcilePair('dre_frete_perc', 'dre_frete_valor', receitaBrutaBase);
    }

    function calculateIndustry() {
        const { ind_receitaLiquida_valor, ind_icms_perc, ind_pisCofins_perc, ind_ipi_valor, ind_st_valor } = state.inputs;
        const icms_p = ind_icms_perc / 100;
        const piscofins_p = ind_pisCofins_perc / 100;
        const divisor = 1 - icms_p - (piscofins_p * (1 - icms_p));
        const receitaBruta = divisor > 0 ? ind_receitaLiquida_valor / divisor : 0;

        state.ind.receitaBruta_valor = receitaBruta;
        const icmsValor = receitaBruta * icms_p;
        const pisCofinsValor = (receitaBruta - icmsValor) * piscofins_p;
        
        state.inputs.ind_icms_valor = icmsValor;
        state.inputs.ind_pisCofins_valor = pisCofinsValor;
        
        state.ind.precoNFcomIPI_valor = receitaBruta + ind_ipi_valor;
        state.ind.totalNF_valor = state.ind.precoNFcomIPI_valor + ind_st_valor;
    }

    function calculateRetail() {
        const { var_recuperaPisCofins, var_margem_perc, var_icmsVenda_perc, var_pisCofinsVenda_perc } = state.inputs;
        state.var = {}; // Limpa o estado anterior
        state.var.custoCliente_valor = state.ind.totalNF_valor;
        
        if (var_recuperaPisCofins) {
            state.var.custoCliente_valor -= state.inputs.ind_pisCofins_valor;
        }

        const totalTaxAndMarginPerc = (var_margem_perc + var_icmsVenda_perc + var_pisCofinsVenda_perc) / 100;
        const divisor = 1 - totalTaxAndMarginPerc;
        
        state.var.precoVenda_valor = divisor > 0 ? state.var.custoCliente_valor / divisor : 0;
        state.var.icmsVenda_valor = state.var.precoVenda_valor * (var_icmsVenda_perc / 100);
        state.var.pisCofinsVenda_valor = state.var.precoVenda_valor * (var_pisCofinsVenda_perc / 100);
    }

    function calculateAnalysis() {
        const { dre_acordos_valor, dre_cpv_valor, dre_frete_valor } = state.inputs;
        state.dre = {}; // Limpa o estado anterior
        state.dre.receitaBruta_valor = state.ind.receitaBruta_valor;
        state.dre.impostos_valor = state.inputs.ind_pisCofins_valor + state.inputs.ind_icms_valor;
        state.dre.receitaLiquida_valor = state.dre.receitaBruta_valor - state.dre.impostos_valor - dre_acordos_valor;
        state.dre.margemBruta_valor = state.dre.receitaLiquida_valor - dre_cpv_valor;
        state.dre.margemVariavel_valor = state.dre.margemBruta_valor - dre_frete_valor;

        const baseRL = state.dre.receitaLiquida_valor;
        const baseRB = state.dre.receitaBruta_valor;
        state.dre.impostos_perc = baseRB > 0 ? (state.dre.impostos_valor / baseRB) * 100 : 0;
        state.dre.receitaLiquida_perc = baseRB > 0 ? (state.dre.receitaLiquida_valor / baseRB) * 100 : 0;
        state.dre.margemBruta_perc = baseRL > 0 ? (state.dre.margemBruta_valor / baseRL) * 100 : 0;
        state.dre.margemVariavel_perc = baseRL > 0 ? (state.dre.margemVariavel_valor / baseRL) * 100 : 0;
    }

    function updateBuildupUI() {
        // Atualiza campos de valor que podem ter sido reconciliados
        elements.ind_icms_valor.value = formatValue(state.inputs.ind_icms_valor);
        elements.ind_pisCofins_valor.value = formatValue(state.inputs.ind_pisCofins_valor);

        // Atualiza resultados da Indústria
        elements.ind_receitaBruta_valor.textContent = formatCurrency(state.ind.receitaBruta_valor);
        elements.ind_precoNFcomIPI_valor.textContent = formatCurrency(state.ind.precoNFcomIPI_valor);
        elements.ind_totalNF_valor.textContent = formatCurrency(state.ind.totalNF_valor);
        
        // Atualiza resultados do Varejo
        elements.var_custoCliente_valor.textContent = formatCurrency(state.var.custoCliente_valor);
        elements.var_precoVenda_valor.textContent = formatCurrency(state.var.precoVenda_valor);
        elements.var_icmsVenda_valor.textContent = formatCurrency(state.var.icmsVenda_valor);
        elements.var_pisCofinsVenda_valor.textContent = formatCurrency(state.var.pisCofinsVenda_valor);
        
        // Atualiza resultados da DRE
        elements.dre_receitaBruta_valor.textContent = formatCurrency(state.dre.receitaBruta_valor);
        elements.dre_impostos_valor.textContent = formatCurrency(state.dre.impostos_valor);
        elements.dre_impostos_perc.textContent = state.dre.impostos_perc.toFixed(2) + '%';
        elements.dre_receitaLiquida_valor.textContent = formatCurrency(state.dre.receitaLiquida_valor);
        elements.dre_receitaLiquida_perc.textContent = state.dre.receitaLiquida_perc.toFixed(2) + '%';
        elements.dre_margemBruta_valor.textContent = formatCurrency(state.dre.margemBruta_valor);
        elements.dre_margemBruta_perc.textContent = state.dre.margemBruta_perc.toFixed(2) + '%';
        elements.dre_margemVariavel_valor.textContent = formatCurrency(state.dre.margemVariavel_valor);
        elements.dre_margemVariavel_perc.textContent = state.dre.margemVariavel_perc.toFixed(2) + '%';
        
        const profitEl = elements.dre_margemVariavel_valor;
        profitEl.classList.toggle('profit', state.dre.margemVariavel_valor > 0);
        profitEl.classList.toggle('loss', state.dre.margemVariavel_valor < 0);
    }

    function runOriginalSimulation(event) {
        const sourceId = event ? event.target.id : null;
        getAndReconcileInputs(sourceId);
        calculateIndustry();
        calculateRetail();
        calculateAnalysis();
        updateBuildupUI();
    }


    // =================================================================================
    // VISÃO 2: SIMULAÇÃO DE MARGEM (BREAKDOWN) - NOVA LÓGICA
    // =================================================================================

    function runReverseSimulation() {
        // Validação crucial: Garante que a simulação 1 já foi rodada.
        if (!state.var || typeof state.var.custoCliente_valor === 'undefined') {
            elements.sim_custoCliente_valor.textContent = "Rode a Simulação 1";
            return;
        }

        const custoCliente = state.var.custoCliente_valor;
        const precoVendaSimulado = parseInput(elements.sim_precoVenda_valor.value);

        // Busca os percentuais de imposto da visão 1 para consistência
        const icmsVendaPerc = parseInput(elements.var_icmsVenda_perc.value) / 100;
        const pisCofinsVendaPerc = parseInput(elements.var_pisCofinsVenda_perc.value) / 100;

        const impostosVendaValor = (precoVendaSimulado * icmsVendaPerc) + (precoVendaSimulado * pisCofinsVendaPerc);
        const lucroBrutoValor = precoVendaSimulado - custoCliente - impostosVendaValor;
        const margemBrutaPerc = precoVendaSimulado > 0 ? (lucroBrutoValor / precoVendaSimulado) * 100 : 0;

        // Atualiza a UI da Visão 2 (Breakdown)
        elements.sim_custoCliente_valor.textContent = formatCurrency(custoCliente);
        elements.sim_impostosVenda_valor.textContent = formatCurrency(impostosVendaValor);
        elements.sim_lucroBruto_valor.textContent = formatCurrency(lucroBrutoValor);
        elements.sim_margemBruta_perc.textContent = margemBrutaPerc.toFixed(2) + '%';
    }


    // =================================================================================
    // INICIALIZAÇÃO E EVENT LISTENERS
    // =================================================================================
    
    // Adiciona os listeners de input para cada visão específica
    document.getElementById('view-buildup').addEventListener('input', runOriginalSimulation);
    document.getElementById('view-breakdown').addEventListener('input', runReverseSimulation);
    
    // Roda a simulação original uma vez no carregamento da página para popular os campos.
    // runOriginalSimulation(null); // << LINHA COMENTADA/REMOVIDA
});