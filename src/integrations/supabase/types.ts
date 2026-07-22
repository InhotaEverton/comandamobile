export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      adicionais: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          grupo_id: string;
          id: string;
          nome: string;
          ordem: number;
          preco: number;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id: string;
          grupo_id: string;
          id?: string;
          nome: string;
          ordem?: number;
          preco?: number;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          grupo_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          preco?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "adicionais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adicionais_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_adicionais";
            referencedColumns: ["id"];
          },
        ];
      };
      bairros_entrega: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          nome: string;
          pedido_minimo: number | null;
          updated_at: string;
          valor_frete: number;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id: string;
          id?: string;
          nome: string;
          pedido_minimo?: number | null;
          updated_at?: string;
          valor_frete?: number;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          pedido_minimo?: number | null;
          updated_at?: string;
          valor_frete?: number;
        };
        Relationships: [
          {
            foreignKeyName: "bairros_entrega_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      caixas: {
        Row: {
          aberto_em: string;
          created_at: string;
          diferenca: number | null;
          empresa_id: string;
          fechado_em: string | null;
          id: string;
          observacao: string | null;
          operador_id: string;
          status: string;
          valor_esperado: number | null;
          valor_final_informado: number | null;
          valor_inicial: number;
        };
        Insert: {
          aberto_em?: string;
          created_at?: string;
          diferenca?: number | null;
          empresa_id?: string;
          fechado_em?: string | null;
          id?: string;
          observacao?: string | null;
          operador_id: string;
          status?: string;
          valor_esperado?: number | null;
          valor_final_informado?: number | null;
          valor_inicial?: number;
        };
        Update: {
          aberto_em?: string;
          created_at?: string;
          diferenca?: number | null;
          empresa_id?: string;
          fechado_em?: string | null;
          id?: string;
          observacao?: string | null;
          operador_id?: string;
          status?: string;
          valor_esperado?: number | null;
          valor_final_informado?: number | null;
          valor_inicial?: number;
        };
        Relationships: [
          {
            foreignKeyName: "caixas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia: {
        Row: {
          ativo: boolean;
          created_at: string;
          data: string;
          empresa_id: string;
          id: string;
          imagem_url: string | null;
          observacao: string | null;
          publicado_at: string | null;
          status: string;
          titulo: string | null;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          data?: string;
          empresa_id: string;
          id?: string;
          imagem_url?: string | null;
          observacao?: string | null;
          publicado_at?: string | null;
          status?: string;
          titulo?: string | null;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          data?: string;
          empresa_id?: string;
          id?: string;
          imagem_url?: string | null;
          observacao?: string | null;
          publicado_at?: string | null;
          status?: string;
          titulo?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia_adicionais_excluidos: {
        Row: {
          adicional_id: string;
          created_at: string;
          data: string;
          empresa_id: string;
          grupo_id: string;
          id: string;
          produto_id: string;
        };
        Insert: {
          adicional_id: string;
          created_at?: string;
          data: string;
          empresa_id: string;
          grupo_id: string;
          id?: string;
          produto_id: string;
        };
        Update: {
          adicional_id?: string;
          created_at?: string;
          data?: string;
          empresa_id?: string;
          grupo_id?: string;
          id?: string;
          produto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_adicionais_excluidos_adicional_id_fkey";
            columns: ["adicional_id"];
            isOneToOne: false;
            referencedRelation: "adicionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_dia_adicionais_excluidos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_dia_adicionais_excluidos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_adicionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_dia_adicionais_excluidos_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia_carnes: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          nome: string;
          ordem: number;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id: string;
          id?: string;
          nome: string;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_carnes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia_modelos: {
        Row: {
          created_at: string;
          empresa_id: string;
          id: string;
          nome: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          empresa_id: string;
          id?: string;
          nome: string;
          payload: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_modelos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia_produto_grupos: {
        Row: {
          created_at: string;
          data: string;
          empresa_id: string;
          grupo_id: string;
          id: string;
          max_override: number | null;
          min_override: number | null;
          obrigatorio_override: boolean | null;
          ordem: number;
          produto_id: string;
        };
        Insert: {
          created_at?: string;
          data: string;
          empresa_id: string;
          grupo_id: string;
          id?: string;
          max_override?: number | null;
          min_override?: number | null;
          obrigatorio_override?: boolean | null;
          ordem?: number;
          produto_id: string;
        };
        Update: {
          created_at?: string;
          data?: string;
          empresa_id?: string;
          grupo_id?: string;
          id?: string;
          max_override?: number | null;
          min_override?: number | null;
          obrigatorio_override?: boolean | null;
          ordem?: number;
          produto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_produto_grupos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_dia_produto_grupos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_adicionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_dia_produto_grupos_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia_produtos: {
        Row: {
          created_at: string;
          data: string;
          disponivel: boolean;
          empresa_id: string;
          id: string;
          ordem: number;
          preco_override: number | null;
          produto_id: string;
        };
        Insert: {
          created_at?: string;
          data: string;
          disponivel?: boolean;
          empresa_id: string;
          id?: string;
          ordem?: number;
          preco_override?: number | null;
          produto_id: string;
        };
        Update: {
          created_at?: string;
          data?: string;
          disponivel?: boolean;
          empresa_id?: string;
          id?: string;
          ordem?: number;
          preco_override?: number | null;
          produto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_produtos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_dia_produtos_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia_saladas: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          nome: string;
          ordem: number;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id: string;
          id?: string;
          nome: string;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_saladas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_dia_tamanhos: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          nome: string;
          ordem: number;
          preco: number;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id: string;
          id?: string;
          nome: string;
          ordem?: number;
          preco?: number;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          preco?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_dia_tamanhos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_grupo_opcoes: {
        Row: {
          created_at: string;
          disponivel: boolean;
          empresa_id: string;
          grupo_id: string;
          id: string;
          nome: string;
          ordem: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          disponivel?: boolean;
          empresa_id: string;
          grupo_id: string;
          id?: string;
          nome: string;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          disponivel?: boolean;
          empresa_id?: string;
          grupo_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_grupo_opcoes_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "cardapio_grupos_montagem";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_grupos_montagem: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          max_selecao: number;
          nome: string;
          ordem: number;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id: string;
          id?: string;
          max_selecao?: number;
          nome: string;
          ordem?: number;
          tipo: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          max_selecao?: number;
          nome?: string;
          ordem?: number;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cardapio_itens: {
        Row: {
          categoria_exibicao_id: string | null;
          created_at: string;
          destaque: boolean;
          disponivel: boolean;
          empresa_id: string;
          hora_fim: string | null;
          hora_inicio: string | null;
          id: string;
          ordem: number;
          produto_id: string;
          updated_at: string;
          visivel: boolean;
        };
        Insert: {
          categoria_exibicao_id?: string | null;
          created_at?: string;
          destaque?: boolean;
          disponivel?: boolean;
          empresa_id: string;
          hora_fim?: string | null;
          hora_inicio?: string | null;
          id?: string;
          ordem?: number;
          produto_id: string;
          updated_at?: string;
          visivel?: boolean;
        };
        Update: {
          categoria_exibicao_id?: string | null;
          created_at?: string;
          destaque?: boolean;
          disponivel?: boolean;
          empresa_id?: string;
          hora_fim?: string | null;
          hora_inicio?: string | null;
          id?: string;
          ordem?: number;
          produto_id?: string;
          updated_at?: string;
          visivel?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_itens_categoria_exibicao_id_fkey";
            columns: ["categoria_exibicao_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_itens_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_secao_itens: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          ordem: number;
          produto_id: string;
          secao_id: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id: string;
          id?: string;
          ordem?: number;
          produto_id: string;
          secao_id: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          ordem?: number;
          produto_id?: string;
          secao_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_secao_itens_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cardapio_secao_itens_secao_id_fkey";
            columns: ["secao_id"];
            isOneToOne: false;
            referencedRelation: "cardapio_secoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapio_secoes: {
        Row: {
          cardapio_id: string;
          created_at: string;
          descricao: string | null;
          empresa_id: string;
          id: string;
          imagem_url: string | null;
          max_selecao: number;
          min_selecao: number;
          nome: string;
          obrigatorio: boolean;
          ordem: number;
          updated_at: string;
        };
        Insert: {
          cardapio_id: string;
          created_at?: string;
          descricao?: string | null;
          empresa_id: string;
          id?: string;
          imagem_url?: string | null;
          max_selecao?: number;
          min_selecao?: number;
          nome: string;
          obrigatorio?: boolean;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          cardapio_id?: string;
          created_at?: string;
          descricao?: string | null;
          empresa_id?: string;
          id?: string;
          imagem_url?: string | null;
          max_selecao?: number;
          min_selecao?: number;
          nome?: string;
          obrigatorio?: boolean;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cardapio_secoes_cardapio_id_fkey";
            columns: ["cardapio_id"];
            isOneToOne: false;
            referencedRelation: "cardapios";
            referencedColumns: ["id"];
          },
        ];
      };
      cardapios: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string | null;
          dias_semana: number[];
          empresa_id: string;
          hora_fim: string | null;
          hora_inicio: string | null;
          id: string;
          imagem_url: string | null;
          nome: string;
          ordem: number;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          dias_semana?: number[];
          empresa_id: string;
          hora_fim?: string | null;
          hora_inicio?: string | null;
          id?: string;
          imagem_url?: string | null;
          nome: string;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          dias_semana?: number[];
          empresa_id?: string;
          hora_fim?: string | null;
          hora_inicio?: string | null;
          id?: string;
          imagem_url?: string | null;
          nome?: string;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      categorias: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          nome: string;
          ordem: number;
          setor: Database["public"]["Enums"]["setor"];
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome: string;
          ordem?: number;
          setor?: Database["public"]["Enums"]["setor"];
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          setor?: Database["public"]["Enums"]["setor"];
        };
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes_online: {
        Row: {
          bairro: string | null;
          cep: string | null;
          cidade: string | null;
          complemento: string | null;
          created_at: string;
          empresa_id: string;
          estado: string | null;
          forma_pagamento: string | null;
          id: string;
          last_pedido_at: string | null;
          nome: string | null;
          numero: string | null;
          rua: string | null;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          complemento?: string | null;
          created_at?: string;
          empresa_id: string;
          estado?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          last_pedido_at?: string | null;
          nome?: string | null;
          numero?: string | null;
          rua?: string | null;
          updated_at?: string;
          whatsapp: string;
        };
        Update: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          complemento?: string | null;
          created_at?: string;
          empresa_id?: string;
          estado?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          last_pedido_at?: string | null;
          nome?: string | null;
          numero?: string | null;
          rua?: string | null;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_online_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      comanda_historico: {
        Row: {
          acao: string;
          comanda_id: string;
          created_at: string;
          detalhes: Json | null;
          empresa_id: string;
          id: string;
          usuario_id: string | null;
          usuario_nome: string | null;
          valor: number | null;
        };
        Insert: {
          acao: string;
          comanda_id: string;
          created_at?: string;
          detalhes?: Json | null;
          empresa_id?: string;
          id?: string;
          usuario_id?: string | null;
          usuario_nome?: string | null;
          valor?: number | null;
        };
        Update: {
          acao?: string;
          comanda_id?: string;
          created_at?: string;
          detalhes?: Json | null;
          empresa_id?: string;
          id?: string;
          usuario_id?: string | null;
          usuario_nome?: string | null;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "comanda_historico_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      comandas: {
        Row: {
          aberta_em: string;
          acrescimo: number;
          cancelada_em: string | null;
          cancelada_por: string | null;
          cliente_nome: string | null;
          codigo: string;
          couvert_pessoas: number;
          couvert_valor: number;
          desconto: number;
          empresa_id: string;
          endereco_bairro: string | null;
          endereco_cep: string | null;
          endereco_cidade: string | null;
          endereco_complemento: string | null;
          endereco_estado: string | null;
          endereco_numero: string | null;
          endereco_rua: string | null;
          fechada_em: string | null;
          forma_pagamento: string | null;
          garcom_id: string | null;
          id: string;
          mesa_id: string | null;
          motivo_cancelamento: string | null;
          motivo_reabertura: string | null;
          observacao: string | null;
          origem: string;
          reaberta_em: string | null;
          reaberta_por: string | null;
          status: Database["public"]["Enums"]["comanda_status"];
          status_online: string | null;
          taxa_entrega: number;
          taxa_servico: number;
          tempo_estimado_max: number | null;
          tempo_estimado_min: number | null;
          tipo_entrega: string | null;
          total: number;
          troco_para: number | null;
          updated_at: string;
        };
        Insert: {
          aberta_em?: string;
          acrescimo?: number;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          cliente_nome?: string | null;
          codigo: string;
          couvert_pessoas?: number;
          couvert_valor?: number;
          desconto?: number;
          empresa_id?: string;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_estado?: string | null;
          endereco_numero?: string | null;
          endereco_rua?: string | null;
          fechada_em?: string | null;
          forma_pagamento?: string | null;
          garcom_id?: string | null;
          id?: string;
          mesa_id?: string | null;
          motivo_cancelamento?: string | null;
          motivo_reabertura?: string | null;
          observacao?: string | null;
          origem?: string;
          reaberta_em?: string | null;
          reaberta_por?: string | null;
          status?: Database["public"]["Enums"]["comanda_status"];
          status_online?: string | null;
          taxa_entrega?: number;
          taxa_servico?: number;
          tempo_estimado_max?: number | null;
          tempo_estimado_min?: number | null;
          tipo_entrega?: string | null;
          total?: number;
          troco_para?: number | null;
          updated_at?: string;
        };
        Update: {
          aberta_em?: string;
          acrescimo?: number;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          cliente_nome?: string | null;
          codigo?: string;
          couvert_pessoas?: number;
          couvert_valor?: number;
          desconto?: number;
          empresa_id?: string;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_estado?: string | null;
          endereco_numero?: string | null;
          endereco_rua?: string | null;
          fechada_em?: string | null;
          forma_pagamento?: string | null;
          garcom_id?: string | null;
          id?: string;
          mesa_id?: string | null;
          motivo_cancelamento?: string | null;
          motivo_reabertura?: string | null;
          observacao?: string | null;
          origem?: string;
          reaberta_em?: string | null;
          reaberta_por?: string | null;
          status?: Database["public"]["Enums"]["comanda_status"];
          status_online?: string | null;
          taxa_entrega?: number;
          taxa_servico?: number;
          tempo_estimado_max?: number | null;
          tempo_estimado_min?: number | null;
          tipo_entrega?: string | null;
          total?: number;
          troco_para?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comandas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comandas_mesa_id_fkey";
            columns: ["mesa_id"];
            isOneToOne: false;
            referencedRelation: "mesas";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracoes: {
        Row: {
          aceita_entrega: boolean;
          aceita_retirada: boolean;
          cnpj: string | null;
          cobrar_taxa_entrega: boolean;
          couvert_ativo: boolean;
          couvert_valor: number;
          delivery_retirada_ativo: boolean;
          email_comercial: string | null;
          empresa_id: string;
          endereco_bairro: string | null;
          endereco_cep: string | null;
          endereco_cidade: string | null;
          endereco_complemento: string | null;
          endereco_estado: string | null;
          endereco_logradouro: string | null;
          endereco_numero: string | null;
          exibir_cardapio_online: boolean;
          exibir_tempo_estimado: boolean;
          horario_almoco: Json | null;
          horario_ativo: boolean;
          horario_jantar: Json | null;
          horarios: Json;
          id: string;
          inscricao_estadual: string | null;
          logo_url: string | null;
          modo_operacao: string;
          modo_taxa_entrega: string;
          modulos: Json;
          nome_fantasia: string | null;
          pedido_minimo: number;
          pin_diario_ativo: boolean;
          qtd_comandas: number;
          razao_social: string | null;
          responsavel_cpf: string | null;
          responsavel_email: string | null;
          responsavel_nome: string | null;
          responsavel_whatsapp: string | null;
          singleton: boolean;
          taxa_entrega: number;
          taxa_entrega_fixa: number;
          taxa_garcom_ativa: boolean;
          taxa_garcom_auto: boolean;
          taxa_garcom_percentual: number;
          telefone_comercial: string | null;
          tempo_entrega_max: number | null;
          tempo_entrega_min: number | null;
          tempo_preparo_min: number;
          tempo_retirada_max: number | null;
          tempo_retirada_min: number | null;
          tipo_numeracao: string;
          tipo_operacao: string;
          updated_at: string;
          whatsapp_empresa: string | null;
        };
        Insert: {
          aceita_entrega?: boolean;
          aceita_retirada?: boolean;
          cnpj?: string | null;
          cobrar_taxa_entrega?: boolean;
          couvert_ativo?: boolean;
          couvert_valor?: number;
          delivery_retirada_ativo?: boolean;
          email_comercial?: string | null;
          empresa_id?: string;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_estado?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          exibir_cardapio_online?: boolean;
          exibir_tempo_estimado?: boolean;
          horario_almoco?: Json | null;
          horario_ativo?: boolean;
          horario_jantar?: Json | null;
          horarios?: Json;
          id?: string;
          inscricao_estadual?: string | null;
          logo_url?: string | null;
          modo_operacao?: string;
          modo_taxa_entrega?: string;
          modulos?: Json;
          nome_fantasia?: string | null;
          pedido_minimo?: number;
          pin_diario_ativo?: boolean;
          qtd_comandas?: number;
          razao_social?: string | null;
          responsavel_cpf?: string | null;
          responsavel_email?: string | null;
          responsavel_nome?: string | null;
          responsavel_whatsapp?: string | null;
          singleton?: boolean;
          taxa_entrega?: number;
          taxa_entrega_fixa?: number;
          taxa_garcom_ativa?: boolean;
          taxa_garcom_auto?: boolean;
          taxa_garcom_percentual?: number;
          telefone_comercial?: string | null;
          tempo_entrega_max?: number | null;
          tempo_entrega_min?: number | null;
          tempo_preparo_min?: number;
          tempo_retirada_max?: number | null;
          tempo_retirada_min?: number | null;
          tipo_numeracao?: string;
          tipo_operacao?: string;
          updated_at?: string;
          whatsapp_empresa?: string | null;
        };
        Update: {
          aceita_entrega?: boolean;
          aceita_retirada?: boolean;
          cnpj?: string | null;
          cobrar_taxa_entrega?: boolean;
          couvert_ativo?: boolean;
          couvert_valor?: number;
          delivery_retirada_ativo?: boolean;
          email_comercial?: string | null;
          empresa_id?: string;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_estado?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          exibir_cardapio_online?: boolean;
          exibir_tempo_estimado?: boolean;
          horario_almoco?: Json | null;
          horario_ativo?: boolean;
          horario_jantar?: Json | null;
          horarios?: Json;
          id?: string;
          inscricao_estadual?: string | null;
          logo_url?: string | null;
          modo_operacao?: string;
          modo_taxa_entrega?: string;
          modulos?: Json;
          nome_fantasia?: string | null;
          pedido_minimo?: number;
          pin_diario_ativo?: boolean;
          qtd_comandas?: number;
          razao_social?: string | null;
          responsavel_cpf?: string | null;
          responsavel_email?: string | null;
          responsavel_nome?: string | null;
          responsavel_whatsapp?: string | null;
          singleton?: boolean;
          taxa_entrega?: number;
          taxa_entrega_fixa?: number;
          taxa_garcom_ativa?: boolean;
          taxa_garcom_auto?: boolean;
          taxa_garcom_percentual?: number;
          telefone_comercial?: string | null;
          tempo_entrega_max?: number | null;
          tempo_entrega_min?: number | null;
          tempo_preparo_min?: number;
          tempo_retirada_max?: number | null;
          tempo_retirada_min?: number | null;
          tipo_numeracao?: string;
          tipo_operacao?: string;
          updated_at?: string;
          whatsapp_empresa?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "configuracoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      eci_master_users: {
        Row: {
          ativo: boolean;
          created_at: string;
          criado_por: string | null;
          id: string;
          nome: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      empresa_assinaturas: {
        Row: {
          created_at: string;
          empresa_id: string;
          id: string;
          inicio_em: string;
          plano_id: string | null;
          proximo_vencimento: string | null;
          status: string;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          created_at?: string;
          empresa_id: string;
          id?: string;
          inicio_em?: string;
          plano_id?: string | null;
          proximo_vencimento?: string | null;
          status?: string;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          inicio_em?: string;
          plano_id?: string | null;
          proximo_vencimento?: string | null;
          status?: string;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "empresa_assinaturas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empresa_assinaturas_plano_id_fkey";
            columns: ["plano_id"];
            isOneToOne: false;
            referencedRelation: "planos";
            referencedColumns: ["id"];
          },
        ];
      };
      empresas: {
        Row: {
          bloqueada: boolean;
          bloqueada_em: string | null;
          bloqueada_motivo: string | null;
          cnpj: string | null;
          created_at: string;
          endereco_bairro: string | null;
          endereco_cep: string | null;
          endereco_cidade: string | null;
          endereco_complemento: string | null;
          endereco_estado: string | null;
          endereco_logradouro: string | null;
          endereco_numero: string | null;
          id: string;
          inscricao_estadual: string | null;
          modulos_liberados: Json;
          nome: string;
          nome_fantasia: string | null;
          onboarding_completo: boolean;
          onboarding_etapa: number;
          pedido_online_ativo: boolean;
          razao_social: string | null;
          slug: string | null;
          tipo_operacao: string;
          ultimo_acesso: string | null;
          updated_at: string;
        };
        Insert: {
          bloqueada?: boolean;
          bloqueada_em?: string | null;
          bloqueada_motivo?: string | null;
          cnpj?: string | null;
          created_at?: string;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_estado?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          id?: string;
          inscricao_estadual?: string | null;
          modulos_liberados?: Json;
          nome: string;
          nome_fantasia?: string | null;
          onboarding_completo?: boolean;
          onboarding_etapa?: number;
          pedido_online_ativo?: boolean;
          razao_social?: string | null;
          slug?: string | null;
          tipo_operacao?: string;
          ultimo_acesso?: string | null;
          updated_at?: string;
        };
        Update: {
          bloqueada?: boolean;
          bloqueada_em?: string | null;
          bloqueada_motivo?: string | null;
          cnpj?: string | null;
          created_at?: string;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_estado?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          id?: string;
          inscricao_estadual?: string | null;
          modulos_liberados?: Json;
          nome?: string;
          nome_fantasia?: string | null;
          onboarding_completo?: boolean;
          onboarding_etapa?: number;
          pedido_online_ativo?: boolean;
          razao_social?: string | null;
          slug?: string | null;
          tipo_operacao?: string;
          ultimo_acesso?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      grupos_adicionais: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string | null;
          empresa_id: string;
          id: string;
          max_ilimitado: boolean;
          max_selecao: number;
          min_selecao: number;
          nome: string;
          obrigatorio: boolean;
          ordem: number;
          tipo_selecao: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          empresa_id: string;
          id?: string;
          max_ilimitado?: boolean;
          max_selecao?: number;
          min_selecao?: number;
          nome: string;
          obrigatorio?: boolean;
          ordem?: number;
          tipo_selecao?: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          empresa_id?: string;
          id?: string;
          max_ilimitado?: boolean;
          max_selecao?: number;
          min_selecao?: number;
          nome?: string;
          obrigatorio?: boolean;
          ordem?: number;
          tipo_selecao?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grupos_adicionais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      itens_pedido: {
        Row: {
          cancelado: boolean;
          cancelado_em: string | null;
          cancelado_por: string | null;
          created_at: string;
          empresa_id: string;
          id: string;
          motivo_cancelamento: string | null;
          observacao: string | null;
          pedido_id: string;
          preco_unit: number;
          produto_id: string;
          produto_nome: string;
          quantidade: number;
          subtotal: number | null;
        };
        Insert: {
          cancelado?: boolean;
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          motivo_cancelamento?: string | null;
          observacao?: string | null;
          pedido_id: string;
          preco_unit: number;
          produto_id: string;
          produto_nome: string;
          quantidade?: number;
          subtotal?: number | null;
        };
        Update: {
          cancelado?: boolean;
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          motivo_cancelamento?: string | null;
          observacao?: string | null;
          pedido_id?: string;
          preco_unit?: number;
          produto_id?: string;
          produto_nome?: string;
          quantidade?: number;
          subtotal?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "itens_pedido_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_pedido_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      itens_pedido_adicionais: {
        Row: {
          adicional_id: string | null;
          adicional_nome: string;
          created_at: string;
          empresa_id: string;
          grupo_id: string | null;
          grupo_nome: string | null;
          id: string;
          item_pedido_id: string;
          preco: number;
          quantidade: number;
        };
        Insert: {
          adicional_id?: string | null;
          adicional_nome: string;
          created_at?: string;
          empresa_id: string;
          grupo_id?: string | null;
          grupo_nome?: string | null;
          id?: string;
          item_pedido_id: string;
          preco?: number;
          quantidade?: number;
        };
        Update: {
          adicional_id?: string | null;
          adicional_nome?: string;
          created_at?: string;
          empresa_id?: string;
          grupo_id?: string | null;
          grupo_nome?: string | null;
          id?: string;
          item_pedido_id?: string;
          preco?: number;
          quantidade?: number;
        };
        Relationships: [
          {
            foreignKeyName: "itens_pedido_adicionais_adicional_id_fkey";
            columns: ["adicional_id"];
            isOneToOne: false;
            referencedRelation: "adicionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_pedido_adicionais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_pedido_adicionais_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_adicionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_pedido_adicionais_item_pedido_id_fkey";
            columns: ["item_pedido_id"];
            isOneToOne: false;
            referencedRelation: "itens_pedido";
            referencedColumns: ["id"];
          },
        ];
      };
      master_financeiro_mensalidades: {
        Row: {
          competencia: string;
          created_at: string;
          empresa_id: string;
          id: string;
          observacao: string | null;
          pago_em: string | null;
          status: string;
          updated_at: string;
          valor: number;
          vencimento: string | null;
        };
        Insert: {
          competencia: string;
          created_at?: string;
          empresa_id: string;
          id?: string;
          observacao?: string | null;
          pago_em?: string | null;
          status?: string;
          updated_at?: string;
          valor: number;
          vencimento?: string | null;
        };
        Update: {
          competencia?: string;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          observacao?: string | null;
          pago_em?: string | null;
          status?: string;
          updated_at?: string;
          valor?: number;
          vencimento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "master_financeiro_mensalidades_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      master_logs: {
        Row: {
          acao: string;
          created_at: string;
          detalhes: Json;
          empresa_afetada: string | null;
          id: string;
          ip: string | null;
          user_id: string | null;
        };
        Insert: {
          acao: string;
          created_at?: string;
          detalhes?: Json;
          empresa_afetada?: string | null;
          id?: string;
          ip?: string | null;
          user_id?: string | null;
        };
        Update: {
          acao?: string;
          created_at?: string;
          detalhes?: Json;
          empresa_afetada?: string | null;
          id?: string;
          ip?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "master_logs_empresa_afetada_fkey";
            columns: ["empresa_afetada"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      master_suporte_acessos: {
        Row: {
          empresa_id: string;
          encerrado_em: string | null;
          id: string;
          iniciado_em: string;
          master_user_id: string;
          motivo: string;
        };
        Insert: {
          empresa_id: string;
          encerrado_em?: string | null;
          id?: string;
          iniciado_em?: string;
          master_user_id: string;
          motivo: string;
        };
        Update: {
          empresa_id?: string;
          encerrado_em?: string | null;
          id?: string;
          iniciado_em?: string;
          master_user_id?: string;
          motivo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "master_suporte_acessos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      mesas: {
        Row: {
          created_at: string;
          empresa_id: string;
          id: string;
          lugares: number;
          numero: number;
          setor: string | null;
          status: Database["public"]["Enums"]["mesa_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          lugares?: number;
          numero: number;
          setor?: string | null;
          status?: Database["public"]["Enums"]["mesa_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          lugares?: number;
          numero?: number;
          setor?: string | null;
          status?: Database["public"]["Enums"]["mesa_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mesas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      movimentacoes_caixa: {
        Row: {
          caixa_id: string;
          created_at: string;
          descricao: string | null;
          empresa_id: string;
          id: string;
          registrado_por: string | null;
          tipo: string;
          valor: number;
        };
        Insert: {
          caixa_id: string;
          created_at?: string;
          descricao?: string | null;
          empresa_id?: string;
          id?: string;
          registrado_por?: string | null;
          tipo: string;
          valor: number;
        };
        Update: {
          caixa_id?: string;
          created_at?: string;
          descricao?: string | null;
          empresa_id?: string;
          id?: string;
          registrado_por?: string | null;
          tipo?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_caixa_id_fkey";
            columns: ["caixa_id"];
            isOneToOne: false;
            referencedRelation: "caixas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimentacoes_caixa_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      pagamentos: {
        Row: {
          caixa_id: string | null;
          cliente_nome: string | null;
          comanda_id: string;
          created_at: string;
          empresa_id: string;
          forma: Database["public"]["Enums"]["forma_pagamento"];
          id: string;
          origem: string | null;
          registrado_por: string | null;
          valor: number;
        };
        Insert: {
          caixa_id?: string | null;
          cliente_nome?: string | null;
          comanda_id: string;
          created_at?: string;
          empresa_id?: string;
          forma: Database["public"]["Enums"]["forma_pagamento"];
          id?: string;
          origem?: string | null;
          registrado_por?: string | null;
          valor: number;
        };
        Update: {
          caixa_id?: string | null;
          cliente_nome?: string | null;
          comanda_id?: string;
          created_at?: string;
          empresa_id?: string;
          forma?: Database["public"]["Enums"]["forma_pagamento"];
          id?: string;
          origem?: string | null;
          registrado_por?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pagamentos_caixa_id_fkey";
            columns: ["caixa_id"];
            isOneToOne: false;
            referencedRelation: "caixas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagamentos_comanda_id_fkey";
            columns: ["comanda_id"];
            isOneToOne: false;
            referencedRelation: "comandas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      pedidos: {
        Row: {
          comanda_id: string;
          created_at: string;
          criado_por: string | null;
          empresa_id: string;
          id: string;
          setor: Database["public"]["Enums"]["setor"];
          status: Database["public"]["Enums"]["pedido_status"];
          total: number;
          updated_at: string;
        };
        Insert: {
          comanda_id: string;
          created_at?: string;
          criado_por?: string | null;
          empresa_id?: string;
          id?: string;
          setor?: Database["public"]["Enums"]["setor"];
          status?: Database["public"]["Enums"]["pedido_status"];
          total?: number;
          updated_at?: string;
        };
        Update: {
          comanda_id?: string;
          created_at?: string;
          criado_por?: string | null;
          empresa_id?: string;
          id?: string;
          setor?: Database["public"]["Enums"]["setor"];
          status?: Database["public"]["Enums"]["pedido_status"];
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pedidos_comanda_id_fkey";
            columns: ["comanda_id"];
            isOneToOne: false;
            referencedRelation: "comandas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedidos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      pin_diario: {
        Row: {
          created_at: string;
          criado_por: string | null;
          data: string;
          empresa_id: string;
          id: string;
          pin: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          criado_por?: string | null;
          data: string;
          empresa_id?: string;
          id?: string;
          pin: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          criado_por?: string | null;
          data?: string;
          empresa_id?: string;
          id?: string;
          pin?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pin_diario_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      planos: {
        Row: {
          ativo: boolean;
          codigo: string;
          created_at: string;
          descricao: string | null;
          id: string;
          max_pedidos_mes: number | null;
          max_usuarios: number | null;
          modulos: Json;
          nome: string;
          ordem: number;
          preco_mensal: number;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          codigo: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          max_pedidos_mes?: number | null;
          max_usuarios?: number | null;
          modulos?: Json;
          nome: string;
          ordem?: number;
          preco_mensal?: number;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          codigo?: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          max_pedidos_mes?: number | null;
          max_usuarios?: number | null;
          modulos?: Json;
          nome?: string;
          ordem?: number;
          preco_mensal?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      produto_grupos_adicionais: {
        Row: {
          created_at: string;
          empresa_id: string;
          grupo_id: string;
          id: string;
          max_selecao: number;
          min_selecao: number;
          obrigatorio: boolean;
          ordem: number;
          produto_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          empresa_id: string;
          grupo_id: string;
          id?: string;
          max_selecao?: number;
          min_selecao?: number;
          obrigatorio?: boolean;
          ordem?: number;
          produto_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          empresa_id?: string;
          grupo_id?: string;
          id?: string;
          max_selecao?: number;
          min_selecao?: number;
          obrigatorio?: boolean;
          ordem?: number;
          produto_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "produto_grupos_adicionais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produto_grupos_adicionais_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_adicionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produto_grupos_adicionais_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      produtos: {
        Row: {
          ativo: boolean;
          cardapio_do_dia: boolean;
          cardapio_montagem_id: string | null;
          categoria_id: string | null;
          created_at: string;
          descricao: string | null;
          empresa_id: string;
          exibir_online: boolean;
          exige_preparo: boolean;
          id: string;
          imagem_url: string | null;
          nome: string;
          preco: number;
          tem_adicionais: boolean;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          cardapio_do_dia?: boolean;
          cardapio_montagem_id?: string | null;
          categoria_id?: string | null;
          created_at?: string;
          descricao?: string | null;
          empresa_id?: string;
          exibir_online?: boolean;
          exige_preparo?: boolean;
          id?: string;
          imagem_url?: string | null;
          nome: string;
          preco: number;
          tem_adicionais?: boolean;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          cardapio_do_dia?: boolean;
          cardapio_montagem_id?: string | null;
          categoria_id?: string | null;
          created_at?: string;
          descricao?: string | null;
          empresa_id?: string;
          exibir_online?: boolean;
          exige_preparo?: boolean;
          id?: string;
          imagem_url?: string | null;
          nome?: string;
          preco?: number;
          tem_adicionais?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "produtos_cardapio_montagem_id_fkey";
            columns: ["cardapio_montagem_id"];
            isOneToOne: false;
            referencedRelation: "cardapios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produtos_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produtos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          ativo: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          nome: string;
          telefone: string | null;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id: string;
          nome: string;
          telefone?: string | null;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          telefone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitacoes_sistema: {
        Row: {
          created_at: string;
          empresa_id: string;
          id: string;
          motivo: string | null;
          resolvido_em: string | null;
          resolvido_por: string | null;
          resposta_master: string | null;
          solicitado_por: string | null;
          status: string;
          tipo_atual: string | null;
          tipo_solicitacao: string;
          tipo_solicitado: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          empresa_id: string;
          id?: string;
          motivo?: string | null;
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          resposta_master?: string | null;
          solicitado_por?: string | null;
          status?: string;
          tipo_atual?: string | null;
          tipo_solicitacao: string;
          tipo_solicitado?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          motivo?: string | null;
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          resposta_master?: string | null;
          solicitado_por?: string | null;
          status?: string;
          tipo_atual?: string | null;
          tipo_solicitacao?: string;
          tipo_solicitado?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "solicitacoes_sistema_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          empresa_id: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _preset_modulos: { Args: { _tipo: string }; Returns: Json };
      aplicar_tipo_operacao: { Args: { _tipo: string }; Returns: Json };
      buscar_cliente_online: {
        Args: { _slug: string; _whatsapp: string };
        Returns: Json;
      };
      cardapio_dia_aplicar_datas: {
        Args: { _datas: string[]; _de: string };
        Returns: Json;
      };
      cardapio_dia_aplicar_modelo: {
        Args: { _data: string; _id: string };
        Returns: Json;
      };
      cardapio_dia_duplicar: {
        Args: { _de: string; _para: string };
        Returns: Json;
      };
      cardapio_dia_publicar: { Args: { _data: string }; Returns: Json };
      cardapio_dia_salvar_modelo: {
        Args: { _data: string; _nome: string };
        Returns: Json;
      };
      cardapio_dia_upsert: { Args: { _payload: Json }; Returns: Json };
      criar_pedido_marmita: {
        Args: {
          _carne_id: string;
          _cliente: string;
          _entrega?: Json;
          _observacao?: string;
          _salada_ids: Json;
          _slug: string;
          _tamanho_id: string;
          _tipo: string;
          _whatsapp: string;
        };
        Returns: Json;
      };
      criar_pedido_online: {
        Args: {
          _cliente: string;
          _entrega?: Json;
          _itens: Json;
          _pagamento?: Json;
          _slug: string;
          _tipo: string;
          _whatsapp: string;
        };
        Returns: Json;
      };
      finalizar_onboarding: { Args: { _payload: Json }; Returns: Json };
      get_cardapio_dia_publico: { Args: { _slug: string }; Returns: Json };
      get_cardapio_publico: { Args: { _slug: string }; Returns: Json };
      get_configuracoes_completo: {
        Args: never;
        Returns: {
          aceita_entrega: boolean;
          aceita_retirada: boolean;
          cnpj: string | null;
          cobrar_taxa_entrega: boolean;
          couvert_ativo: boolean;
          couvert_valor: number;
          delivery_retirada_ativo: boolean;
          email_comercial: string | null;
          empresa_id: string;
          endereco_bairro: string | null;
          endereco_cep: string | null;
          endereco_cidade: string | null;
          endereco_complemento: string | null;
          endereco_estado: string | null;
          endereco_logradouro: string | null;
          endereco_numero: string | null;
          exibir_cardapio_online: boolean;
          exibir_tempo_estimado: boolean;
          horario_almoco: Json | null;
          horario_ativo: boolean;
          horario_jantar: Json | null;
          horarios: Json;
          id: string;
          inscricao_estadual: string | null;
          logo_url: string | null;
          modo_operacao: string;
          modo_taxa_entrega: string;
          modulos: Json;
          nome_fantasia: string | null;
          pedido_minimo: number;
          pin_diario_ativo: boolean;
          qtd_comandas: number;
          razao_social: string | null;
          responsavel_cpf: string | null;
          responsavel_email: string | null;
          responsavel_nome: string | null;
          responsavel_whatsapp: string | null;
          singleton: boolean;
          taxa_entrega: number;
          taxa_entrega_fixa: number;
          taxa_garcom_ativa: boolean;
          taxa_garcom_auto: boolean;
          taxa_garcom_percentual: number;
          telefone_comercial: string | null;
          tempo_entrega_max: number | null;
          tempo_entrega_min: number | null;
          tempo_preparo_min: number;
          tempo_retirada_max: number | null;
          tempo_retirada_min: number | null;
          tipo_numeracao: string;
          tipo_operacao: string;
          updated_at: string;
          whatsapp_empresa: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "configuracoes";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_configuracoes_publicas: {
        Args: never;
        Returns: {
          couvert_ativo: boolean;
          couvert_valor: number;
          horario_almoco: Json;
          horario_ativo: boolean;
          horario_jantar: Json;
          horarios: Json;
          id: string;
          modo_operacao: string;
          modulos: Json;
          pin_diario_ativo: boolean;
          qtd_comandas: number;
          singleton: boolean;
          taxa_garcom_ativa: boolean;
          taxa_garcom_auto: boolean;
          taxa_garcom_percentual: number;
          tipo_numeracao: string;
          tipo_operacao: string;
          updated_at: string;
        }[];
      };
      get_empresa_id_do_usuario: { Args: { _user_id: string }; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_eci_master: { Args: { _user_id: string }; Returns: boolean };
      master_aprovar_solicitacao: {
        Args: { _id: string; _resposta?: string };
        Returns: Json;
      };
      master_bloquear_empresa: {
        Args: { _empresa_id: string; _motivo: string };
        Returns: Json;
      };
      master_desbloquear_empresa: {
        Args: { _empresa_id: string };
        Returns: Json;
      };
      master_rejeitar_solicitacao: {
        Args: { _id: string; _resposta: string };
        Returns: Json;
      };
      master_stats_dashboard: { Args: never; Returns: Json };
      minha_empresa_bloqueada: { Args: never; Returns: Json };
      minha_empresa_id: { Args: never; Returns: string };
      regenerar_pool_comandas: { Args: { _qtd: number }; Returns: Json };
      reparar_identidade_auth_orfa_por_email: {
        Args: { _email: string };
        Returns: number;
      };
      solicitar_alteracao_tipo: {
        Args: { _motivo: string; _tipo_solicitado: string };
        Returns: Json;
      };
      sou_eci_master: { Args: never; Returns: boolean };
      validar_pin_hoje: { Args: { _pin: string }; Returns: boolean };
      verificar_slug_disponivel: { Args: { _slug: string }; Returns: Json };
    };
    Enums: {
      app_role: "admin" | "garcom" | "cozinha" | "caixa";
      comanda_status: "aberta" | "fechando" | "fechada" | "cancelada";
      forma_pagamento: "pix" | "dinheiro" | "credito" | "debito" | "convenio";
      mesa_status: "livre" | "ocupada" | "fechando" | "fechamento_solicitado" | "em_pagamento";
      pedido_status: "pendente" | "preparo" | "pronto" | "entregue" | "cancelado";
      setor: "cozinha" | "bar" | "sobremesas";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "garcom", "cozinha", "caixa"],
      comanda_status: ["aberta", "fechando", "fechada", "cancelada"],
      forma_pagamento: ["pix", "dinheiro", "credito", "debito", "convenio"],
      mesa_status: ["livre", "ocupada", "fechando", "fechamento_solicitado", "em_pagamento"],
      pedido_status: ["pendente", "preparo", "pronto", "entregue", "cancelado"],
      setor: ["cozinha", "bar", "sobremesas"],
    },
  },
} as const;
