--
-- PostgreSQL database dump
--

\restrict 3IPuftKgcDga6J7JnGxcgmD32jpPhJsw8FJbKM4jF3oIekaoYt7XGJGqrQbJxOV

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.wallet_withdrawals DROP CONSTRAINT IF EXISTS wallet_withdrawals_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.wallet_deposits DROP CONSTRAINT IF EXISTS wallet_deposits_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.verifications DROP CONSTRAINT IF EXISTS verifications_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_exam_id_exams_id_fk;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS registrations_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS registrations_exam_id_exams_id_fk;
ALTER TABLE IF EXISTS ONLY public.questions DROP CONSTRAINT IF EXISTS questions_exam_id_exams_id_fk;
ALTER TABLE IF EXISTS ONLY public.wallet_withdrawals DROP CONSTRAINT IF EXISTS wallet_withdrawals_pkey;
ALTER TABLE IF EXISTS ONLY public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.wallet_deposits DROP CONSTRAINT IF EXISTS wallet_deposits_pkey;
ALTER TABLE IF EXISTS ONLY public.verifications DROP CONSTRAINT IF EXISTS verifications_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS unique_user_exam_submission;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS unique_user_exam;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_pkey;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS registrations_pkey;
ALTER TABLE IF EXISTS ONLY public.questions DROP CONSTRAINT IF EXISTS questions_pkey;
ALTER TABLE IF EXISTS ONLY public.payment_settings DROP CONSTRAINT IF EXISTS payment_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.exams DROP CONSTRAINT IF EXISTS exams_pkey;
ALTER TABLE IF EXISTS public.wallet_withdrawals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.wallet_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.wallet_deposits ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.verifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.submissions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.registrations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.questions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.payment_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.exams ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.wallet_withdrawals_id_seq;
DROP TABLE IF EXISTS public.wallet_withdrawals;
DROP SEQUENCE IF EXISTS public.wallet_transactions_id_seq;
DROP TABLE IF EXISTS public.wallet_transactions;
DROP SEQUENCE IF EXISTS public.wallet_deposits_id_seq;
DROP TABLE IF EXISTS public.wallet_deposits;
DROP SEQUENCE IF EXISTS public.verifications_id_seq;
DROP TABLE IF EXISTS public.verifications;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.submissions_id_seq;
DROP TABLE IF EXISTS public.submissions;
DROP SEQUENCE IF EXISTS public.registrations_id_seq;
DROP TABLE IF EXISTS public.registrations;
DROP SEQUENCE IF EXISTS public.questions_id_seq;
DROP TABLE IF EXISTS public.questions;
DROP SEQUENCE IF EXISTS public.payment_settings_id_seq;
DROP TABLE IF EXISTS public.payment_settings;
DROP SEQUENCE IF EXISTS public.exams_id_seq;
DROP TABLE IF EXISTS public.exams;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    entry_fee numeric(10,2) DEFAULT 5.00 NOT NULL,
    status text DEFAULT 'upcoming'::text NOT NULL,
    solution_pdf_url text,
    prize_pool numeric(10,2) DEFAULT 0.00 NOT NULL,
    rewards_distributed text DEFAULT 'false'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: payment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_settings (
    id integer NOT NULL,
    qr_code_url text,
    upi_id character varying(100),
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_settings_id_seq OWNED BY public.payment_settings.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    exam_id integer NOT NULL,
    question_text text NOT NULL,
    option_a text NOT NULL,
    option_b text NOT NULL,
    option_c text NOT NULL,
    option_d text NOT NULL,
    correct_option text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registrations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    exam_id integer NOT NULL,
    amount_paid numeric(10,2) DEFAULT 5.00 NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registrations_id_seq OWNED BY public.registrations.id;


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    exam_id integer NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    total_questions integer DEFAULT 0 NOT NULL,
    correct_answers integer DEFAULT 0 NOT NULL,
    time_taken_seconds integer DEFAULT 0 NOT NULL,
    rank integer,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    wallet_balance numeric(10,2) DEFAULT 0.00 NOT NULL,
    avatar_url text,
    is_admin boolean DEFAULT false NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    govt_id text,
    pan_card_url text,
    verification_status text DEFAULT 'not_submitted'::text NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    govt_id text NOT NULL,
    pan_card_url text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verifications_id_seq OWNED BY public.verifications.id;


--
-- Name: wallet_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_deposits (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    utr_number character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallet_deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallet_deposits_id_seq OWNED BY public.wallet_deposits.id;


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    balance_after numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallet_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallet_transactions_id_seq OWNED BY public.wallet_transactions.id;


--
-- Name: wallet_withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_withdrawals (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(20) DEFAULT 'upi'::character varying NOT NULL,
    payment_details text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_utr_number character varying(100),
    admin_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallet_withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallet_withdrawals_id_seq OWNED BY public.wallet_withdrawals.id;


--
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: payment_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settings ALTER COLUMN id SET DEFAULT nextval('public.payment_settings_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: registrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations ALTER COLUMN id SET DEFAULT nextval('public.registrations_id_seq'::regclass);


--
-- Name: submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions ALTER COLUMN id SET DEFAULT nextval('public.submissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications ALTER COLUMN id SET DEFAULT nextval('public.verifications_id_seq'::regclass);


--
-- Name: wallet_deposits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_deposits ALTER COLUMN id SET DEFAULT nextval('public.wallet_deposits_id_seq'::regclass);


--
-- Name: wallet_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.wallet_transactions_id_seq'::regclass);


--
-- Name: wallet_withdrawals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_withdrawals ALTER COLUMN id SET DEFAULT nextval('public.wallet_withdrawals_id_seq'::regclass);


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exams (id, title, category, start_time, end_time, entry_fee, status, solution_pdf_url, prize_pool, rewards_distributed, created_at, updated_at) FROM stdin;
9	SSC CHSL General Studies	SSC	2026-04-02 04:31:01.541+00	2026-04-02 04:51:01.541+00	5.00	upcoming	\N	20000.00	false	2026-04-02 07:31:24.643877+00	2026-04-02 07:31:24.643877+00
10	SBI Clerk Prelims Mock	Banking	2026-04-02 02:31:01.541+00	2026-04-02 02:51:01.541+00	5.00	upcoming	\N	35000.00	false	2026-04-02 07:31:28.497988+00	2026-04-02 07:31:28.497988+00
12	NDA & NA Mathematics Mock	Defence	2026-04-02 06:01:01.541+00	2026-04-02 06:21:01.541+00	5.00	upcoming	\N	18000.00	false	2026-04-02 07:31:36.297437+00	2026-04-02 07:31:36.297437+00
1	SSC CGL Exam - Set A	SSC	2026-04-02 07:59:59.073494+00	2026-04-02 08:19:59.073494+00	5.00	upcoming	\N	50000.00	false	2026-04-02 07:12:35.240757+00	2026-04-02 07:12:35.240757+00
5	SSC CGL Tier-I Mock Test	SSC	2026-04-02 08:10:02.97496+00	2026-04-02 08:30:02.97496+00	5.00	upcoming	\N	50000.00	false	2026-04-02 07:31:09.17172+00	2026-04-02 07:31:09.17172+00
6	IBPS PO Reasoning & Aptitude	Banking	2026-04-02 08:40:07.167943+00	2026-04-02 09:00:07.167943+00	5.00	upcoming	\N	30000.00	false	2026-04-02 07:31:12.93319+00	2026-04-02 07:31:12.93319+00
11	Indian Army GD Agniveer	Defence	2026-04-02 09:10:11.051389+00	2026-04-02 09:30:11.051389+00	5.00	upcoming	\N	15000.00	false	2026-04-02 07:31:32.418702+00	2026-04-02 07:31:32.418702+00
2	UPSC Prelims Mock	UPSC	2026-04-03 11:00:00+00	2026-04-03 05:20:00+00	5.00	upcoming	\N	30000.00	false	2026-04-02 07:12:39.105689+00	2026-04-02 10:59:09.411+00
3	Banking Awareness Test	Banking	2026-04-02 05:40:00+00	2026-04-02 20:32:00+00	5.00	upcoming	\N	25000.00	false	2026-04-02 07:12:42.855749+00	2026-04-02 11:10:18.175+00
7	RRB NTPC General Awareness	Railways	2026-04-04 01:56:00+00	2026-04-02 02:16:00+00	5.00	upcoming	\N	25000.00	false	2026-04-02 07:31:16.916551+00	2026-04-02 11:28:14.398+00
4	UPSC Civil Services Prelims 2026	UPSC	2026-04-04 04:01:00+00	2026-04-04 04:25:00+00	5.00	upcoming	\N	100000.00	true	2026-04-02 07:31:05.416513+00	2026-04-02 11:28:44.416+00
8	UPSC CSAT Paper II Practice	UPSC	2026-04-02 12:40:00+00	2026-04-02 14:12:00+00	5.00	upcoming	\N	75000.00	false	2026-04-02 07:31:20.753547+00	2026-04-02 12:38:56.354+00
\.


--
-- Data for Name: payment_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_settings (id, qr_code_url, upi_id, updated_at) FROM stdin;
1	data:image/png;base64,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ey1atNBf/vIXdenSRWVlZVU+A/Ly8oxWhK1atdLMmTN11VVXGWX0t+0AQEOihRgAv7Zu3TqNHDnSeGifPHmytmzZok2bNhl/cfWWim4O06ZNM76MFxYWas+ePVq3bp127typvLw8hYaG6qKLLtLFF1+sTp06yW63y2w265prrlFubq5effVVlZaWVln3pEmTNGXKFGO8jaKiIu3du1cbNmzQjh07lJubK4vFohYtWujiiy9W7969jTG0xo4dq4yMDLeuTucSFBSk6dOny26368CBA1q/fr1++eUXZWVlyWazqU2bNho0aJA6dOig0NBQSVLXrl11++23669//au3Dqnhk08+Ubt27RQSEiKbzab77rtP06dPl8PhUMuWLfX73/9eo0aNknT6wWb37t16+eWXvV4ObzvzYfdsfwmvz3NfVlampUuX6rbbbpN0ugXJhAkTPGoVGRoaqmHDhhnLhYWFmj9/vuc776eGDRum22+/3fjMyMvL0549e7R27VodPHhQOTk5CgsLU8eOHTVkyBC1adNGFotFrVu31oMPPqh7773Xa9186qseBgUF6cYbb9Q111xj/KygoEA7d+7U2rVrtWfPHhUWFioyMlKdOnVSSkqK2rRpo3HjxrkN6u2PPKlTZzKZTLrvvvsUGRnp8XHu3Lmz7rjjjnN2F63rPWHy5MkqLCzU66+/XiXwOZv6ul7MZrMuv/xyTZ061diPvLw87d27V2vWrDHqRUREhNq3b69LLrlEbdu2VWhoqCIiIvSHP/xBx48fN8bBqg+ennd/35egoCCNGDHCbT++/fZbt9csWbJEkyZNMso/btw4twmAaiI4OFj33HOPOnTooNzcXG3fvl0bNmzQ/v37jc+Azp07q1+/fkpKSlJQUJCCg4M1bdo0HTt2TEuWLPGr7QBAQyMQA+DXFi9erClTpqhNmzYymUyKiorSk08+qc8//1zz589XTk6OHA6HV7pAJCYm6ve//73xJbW4uFjLly/X888/f9axrN5++21NnTpV11xzjdGCZ/LkyVq+fHmVMUGaNm3qFogUFxdr5cqVevbZZ3Xs2LEq637//fc1depU3XrrrQoODpbJZNL111+vzz77zKPucM2aNVNCQoI2btyo559//qwtrT766CM9/PDDuuyyy4zwYOzYsXrttde83sXhiy++0IgRIzRkyBCZzWYlJyfr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je6+++5z1j/8T13uCePHj3cbA3Dfvn0+64a7Z88erVu3zlhOTk7WFVdc4VHo27p1az3//PP697//rccff1zXXXddfRb1vPxtX6KiotSvXz9jOT8/3xivsKaWLFni1lJ16NChHs+CmZCQoJtuuum8343i4uJ02223GZ+JTqdTixcv9riMDbUdAGhIfCsC4Lf27NmjFStWGKGKxWLR9OnTddlll6lFixbVflmMiIhQQkKCRo0apccff9xoJeJ0OrV8+fJqx7F499133QaMveqqq3TdddcpNja2SjdIi8WimJgYjRgxQlOnTjV+XlhYqM8//9zttZmZmW5T0Hfr1k1DhgxRTExMlYfToKAgNW/eXMOHD9e99957vkPk19LS0tzGzUlJSdGf//xndevWTfHx8YqOjlZkZKSaNGmi5s2bq3Xr1hoxYoSefvppt64WFa655hq1adOmIXehznx17g8cOKAff/zRWB4+fLhx7EpLSzVv3rw6rd8Ta9as0bJly4xxcMxms373u9/p5ptvVmJioqKios4aVoWHh6tFixYaM2aMZs2aZYRVTqdT27Zt0yeffFLtNouKihQfHy+z2SyLxaJ77rlHbdu2PWsrkpCQECUkJOiuu+5SdHS08fPNmzeftVu1P3nrrbd06tQpY7l///565JFHqtSt6OhoJSQkqG/fvnriiSfUtm1br82sFwhqek9o2rSpRo4cqWnTphk/Lyws1Pvvv+/Ta+rdd981JgkwmUy6++67NW7cOMXHx581oLfb7brooos0Y8YMNW/eXE2aNNEll1xy1s/lhuZP+zJ69Gi3gD8jI6PWf2g4ePCgW5fC2NhYDRs27LzvczqdKi4u1g033KAxY8aoWbNmVcafDAkJUcuWLTVjxgy3P7ScOHFCn332mUfla6jtAEBDa7yjNQMICK+99po6deqkpKQkmc1mxcTE6LHHHtP69eu1fPly/fTTTyouLjYG8LbZbEpJSdHgwYN1ySWXGGOGOJ1O7d27V2+++Wa128rIyNCnn36qyZMnKywsTBaLRb/73e/UoUMHzZ8/X4cPHza2Ex0drdGjR2v8+PHGw3Zpaam+++47ff3111XWvXDhQt16660KCgpScHCwHn/8cX311VdatGiRHA6HnE6nLBaLWrVqpcsuu0yjR4+W1WrV4cOHlZiYWD8Ht55lZmZq7ty5uvfeexUdHS2TyaTBgwerV69eSk9P1969e5Wfn6+QkBDFxcWpc+fOatu2rREUlZeXKzMzUzExMQoODlZiYqL++Mc/6o9//GOjeqj31blfsGCBBg4cKIvFYgwaL0n79+93a/lSn1566SUlJCSoZ8+eCgoKUkhIiG677Tb1799fK1as0A8//KCCggJjjDmr1arevXtr6NCh6tevnxE6OJ1OHTx4UM8999xZZyqtMG/ePF199dXGmD49evTQnDlz9Pnnn2vt2rVGKGGxWNS5c2elpqa6deV1OBz69NNP6/GIeEdGRoY++OAD3XTTTcbnz5AhQ9SjRw+lp6frwIEDKigokN1uV/v27dWrVy+FhYUpOztbH3zwge6++24f70HjUJN7QkxMjHFPqPhjTUlJiVasWOHzrt7r16/X559/rkmTJhmzBT700EMaNGiQFi9erJ07d7rVwYEDB2r8+PFuXXGzsrL0n//8x4d7cZq/7IvFYtGYMWOMZZfLpW+++aZO61y6dKlSUlKMz+rLL79cCxcudBvL7kylpaXasGGDBgwYoEceeUQLFizQ4sWLjZkuLRaLOnXqpIkTJ7qNxZifn6933nlHx44d86hsDbUdAGhoBGIA/Nr+/fv117/+VQ888IASExNls9kUFBSkgQMHauDAgSopKdGpU6dUUlJifDk+c9ygkpISHThwQM8++6z27dt3zu299tpratasmUaMGCG73a6goCCNGTNGo0ePVlZWlgoKCmSz2dSsWTO3Fj6FhYXatGmT5syZc9b1/ve//1VKSop69eolq9Uqu92uKVOm6Nprr1VOTo6Kiopkt9sVEREhk8mk8vJy7dq1S19++aVmzJhR5+PoK19++aWioqI0efJkNW/eXMHBwbLb7Ro2bFi1f/12uVzKz8/X/v379c9//lPXXnut+vXrJ7PZrH79+unOO+/U3//+97OOM+aPfHXuv/32W504cUItWrQwHrAqxhdrKJmZmXr88cf18MMPq0ePHsY+VowLeOeddyovL095eXmy2WyKjIys0vKmqKhI+/fv10svvXTeWTErQthp06apadOmMplMat++vR588EEVFRUpJydH5eXlstvtbt0kXS6XcnNz9cUXXzSarj1z585VZGSkxowZY7Q4bNKkidtYcRVcLpdOnTql999/Xxs2bPBBaRuv2t4TCgoKtHHjRj377LPVdvFtSK+8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q8Wdkr1er+jbSwKBQIv3z7Vr1yIjIwOPPfZYyFGbEydORGpqKmbMmIEzZ87wD4IooVAo0KlTJ7z++usYMWJEyPLV1dV45ZVXsGHDhqDlpDh+iuX1eiPilkmHwxER+4PL5YLL5RK8vhTn91g6forl9Xoj4rpPo9HAZDKJag+lUin6M1EqlaLu1pCCFP2TiFqO/BPqEBERUavy+uuvY8WKFaitrQ1ZdtSoUVi9ejV69uwp+3xJFJpKpUJeXh5Wr17dpGSY3W7HihUrsGjRojBER0RERPR/eGVJREREYff0009j48aNTRqteO211+KDDz5Av379ZB95S42Li4vDVVddhXXr1mHAgAEhyzscDqxfvx5PP/10GKIjIiIi+iUmxIiIiCjs/H4/HnvsMfz73/9u0kix/Px8bNiwASNHjkRqamoYIqTmSEtLwx133IENGzagZ8+eIcvX1tZi69atmDlzpuinrxEREREJwYQYEVETKRR85DWRlOrq6jBlyhRs3LixSfMMZmVlYdWqVXjssceQm5vLWygjgFKpRMeOHTFr1iysXLkS7dq1C7mO1WrFJ598gocffhhOpzMMURIRERFdjleSREREJBun04lp06Zh7dq1TXoKl1arxezZs7F06VL07dtX9qfstWZ6vR59+vTBihUrMHPmzCZN5l1VVYXVq1fjD3/4A5NhRERNxC9liVoGE2JERE0UCU/0IopFXq8Xs2bNwqJFi1BWVtakdW666SZs3LgRt912G2+hlEFaWhpuv/12bNq0CYMGDWrSOmVlZViyZAmeeOIJeL3eFo6QiIiIKDgmxIiIiCgivPTSS3jhhRdQUlLSpAR0+/btsXbtWjz66KPo3LkztFptGKJs3bRaLTp37ozHH38ca9eubdItkoFAAMXFxXj++efxwgsvhCFKIqLYwi9liVoGE2JEREQUMZYtW4Y///nPOHfuXJP+ANDpdHjyySexdu1a3HjjjcjMzOStJS1AoVAgMzMTN954I9auXYs///nPTUpA+v1+nD59GjNnzsT7778fhkiJiIiImoYJMSIiIooomzZtwrRp0/DDDz/A7XY3aZ3+/fvj448/xjPPPINevXrBZDK1cJStR0JCAnr37o3nnnsO//rXv9C/f/8mredyufD9999jypQp2Lp1awtHSURERNQ8TIgRERFRxNmzZw/uvfde7NmzB1ar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N2+2ffvr16/X8OHD5XK5opbNmjXLVCDWp0+fmGHK8ePHG8OwROfxeOTxeNSpUycNHDhQM2bM0MMPP6y3335ba9asMXVm13cVFxcrJydH169fb/E6aWlpmjBhguVtxxLvPgkAgFMxhxgAADYbOXKkFixYILfbHe9SmsjNzdVDDz2kl156SRMmTIgZhhlxu92688479Ytf/EKPPPKI8vPz27DStjNnzpzGYaHNmT17dptsf+3atfL7/YbLxo0bp7S0tFa3OWvWrJh9bcOGDa1uL5H07NlTzz77rF588UV17drVcnt5eXmaNm1aq9YZNWpUzCHNdoh3nwQAwKkIxAAAaAMLFy7UwIED411Go/T0dC1cuFBPPfWUsrKyDB/TMGdYMBiMOc9Xenq6Hn/8cT322GNKT09vy5Jtl5qaqrvvvjvqfqPnWlxcrOzsbNtrOH/+vPbt22e4rHfv3ho5cmSr2nO73YbPSZICgYDWrVvX4rbq6upM/YRCoVbVbNRGfX19zD7ncrl0zz336LnnnovZd1tj5syZhmfoxTJ37lzL24wlEfokAABOxZBJAADaQG5urv7qr/5KL774YtSE4/EwduxY/ehHPzI8E8Xr9aqiokLl5eWqrq5WSkqKcnJylJeXp/z8fGVkZDR5vMvl0p/+6Z9qz5497WoI18iRIw3P9KmpqYkKWvLy8jR16lT98Y9/tL2OtWvXqri42DCUuffee1VWVtbitnr27KnBgwcbLjt48KBOnz7d4ra2b9+ucDjc4sc3qKioaNXjjbaTnp6uTp06KTc3V507dza88MB9992nzz77TO+8806LtxWJRKL286233qpu3brp4sWLN1w/IyPDcP66cDjcorO6biRR+iQAAE5EIAYAQBsZN26c7rvvPr3zzjutvrKinVJSUvTkk08aDpG8fv26Vq9erT/84Q/68ssvG+93uVy64447NGfOHE2ZMkV5eXlRbT7++OPasmWLqRAlHoyGnEUiEW3atEmzZ8+OCk5mzJih9957z/bXbuPGjXr22WeVm5sbtaxh2GQgEGhRWzNnzjR8XSORSKuHS/7t3/5tqy94YEas7Xg8HpWUlOj73/++xowZYzh89JFHHtF7773X4qtxBgKBxgtFfHs79913n5YtW3bD9ceNGxc1VDMSicjr9SonJ6dFNTQnUfokAABOxJBJAABs8t0/Ul0u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	9621819282	2026-04-02 14:08:34.781
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.questions (id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_index, created_at) FROM stdin;
1	1	What is the capital of India?	Mumbai	Kolkata	New Delhi	Chennai	c	0	2026-04-02 07:41:24.47749+00
2	1	Which vitamin is produced when skin is exposed to sunlight?	Vitamin A	Vitamin B	Vitamin C	Vitamin D	d	1	2026-04-02 07:41:28.123343+00
3	1	The Bharat Ratna was first awarded in which year?	1950	1952	1954	1966	c	2	2026-04-02 07:41:31.834648+00
4	1	Which is the longest river in India?	Yamuna	Brahmaputra	Ganga	Godavari	c	3	2026-04-02 07:41:35.575649+00
5	1	India's first supercomputer was named?	PARAM	ARYABHATTA	SHAKTI	AGNI	a	4	2026-04-02 07:41:39.289096+00
6	1	The Indian Constitution was adopted on?	15 Aug 1947	26 Jan 1950	26 Nov 1949	30 Jan 1948	c	5	2026-04-02 07:41:43.050547+00
7	1	Panchayati Raj was first introduced in which state?	UP	Rajasthan	Gujarat	Maharashtra	b	6	2026-04-02 07:41:46.901828+00
8	1	Which gas is most abundant in Earth's atmosphere?	Oxygen	CO2	Argon	Nitrogen	d	7	2026-04-02 07:41:50.71756+00
9	1	Who is known as Iron Man of India?	Mahatma Gandhi	Sardar Vallabhbhai Patel	Subhas Chandra Bose	Lal Bahadur Shastri	b	8	2026-04-02 07:41:54.441945+00
10	1	The treaty of Versailles was signed in which year?	1916	1918	1919	1920	c	9	2026-04-02 07:41:58.25798+00
12	2	Which article of Indian Constitution abolishes untouchability?	Article 14	Article 15	Article 17	Article 19	c	1	2026-04-02 07:42:06.011736+00
13	2	Planning Commission was replaced by NITI Aayog in?	2013	2014	2015	2016	c	2	2026-04-02 07:42:09.758406+00
14	2	The Constituent Assembly was formed based on which plan?	Mountbatten Plan	Wavell Plan	Cabinet Mission Plan	Cripps Mission	c	3	2026-04-02 07:42:13.523492+00
15	2	Who was the first Chairman of Planning Commission?	Dr. Ambedkar	Jawaharlal Nehru	Sardar Patel	Rajendra Prasad	b	4	2026-04-02 07:42:17.241706+00
16	2	The term secular was added to Preamble by which amendment?	42nd	44th	52nd	73rd	a	5	2026-04-02 07:42:21.20315+00
17	2	Which schedule contains the anti-defection law?	8th	9th	10th	11th	c	6	2026-04-02 07:42:24.957065+00
18	2	Fundamental Rights are guaranteed under which Part?	Part II	Part III	Part IV	Part V	b	7	2026-04-02 07:42:28.632505+00
19	2	Zero hour in Indian Parliament begins at?	9:00 AM	11:00 AM	12 Noon	2:00 PM	c	8	2026-04-02 07:42:32.409274+00
20	2	Which article empowers Parliament to form new states?	Article 3	Article 5	Article 1	Article 370	a	9	2026-04-02 07:42:36.089967+00
21	3	Reserve Bank of India was established in?	1935	1947	1949	1955	a	0	2026-04-02 07:42:39.921855+00
22	3	What does NEFT stand for?	National Electronic Fund Transfer	National Emergency Fund Transfer	Net Electronic Fund Transfer	National Equity Fund Transfer	a	1	2026-04-02 07:42:43.846835+00
23	3	SBI headquarters is located in?	New Delhi	Kolkata	Mumbai	Bengaluru	c	2	2026-04-02 07:42:47.564639+00
24	3	PMJDY was launched in which year?	2012	2013	2014	2015	c	3	2026-04-02 07:42:51.381316+00
25	3	Which is the apex bank of India?	SBI	NABARD	RBI	SIDBI	c	4	2026-04-02 07:42:55.176417+00
26	3	KYC stands for?	Keep Your Cash	Know Your Customer	Key Your Credit	Know Your Currency	b	5	2026-04-02 07:42:59.098543+00
27	3	Who regulates Mutual Funds in India?	RBI	SEBI	IRDAI	PFRDA	b	6	2026-04-02 07:43:03.307849+00
28	3	CRR stands for?	Credit Reserve Ratio	Cash Reserve Ratio	Capital Reserve Ratio	Current Reserve Ratio	b	7	2026-04-02 07:43:07.330003+00
29	3	The full form of ATM is?	Any Time Money	Automated Teller Machine	Automated Transaction Machine	Automatic Teller Machine	b	8	2026-04-02 07:43:11.104975+00
30	3	World Bank headquarters is located in?	New York	Geneva	Washington DC	London	c	9	2026-04-02 07:43:14.882582+00
32	4	Which article of Indian Constitution abolishes untouchability?	Article 14	Article 15	Article 17	Article 19	c	1	2026-04-02 07:43:22.471565+00
33	4	Planning Commission was replaced by NITI Aayog in?	2013	2014	2015	2016	c	2	2026-04-02 07:43:26.188771+00
34	4	The Constituent Assembly was formed based on which plan?	Mountbatten Plan	Wavell Plan	Cabinet Mission Plan	Cripps Mission	c	3	2026-04-02 07:43:30.023869+00
35	4	Who was the first Chairman of Planning Commission?	Dr. Ambedkar	Jawaharlal Nehru	Sardar Patel	Rajendra Prasad	b	4	2026-04-02 07:43:34.142534+00
36	4	The term secular was added to Preamble by which amendment?	42nd	44th	52nd	73rd	a	5	2026-04-02 07:43:37.901299+00
37	4	Which schedule contains the anti-defection law?	8th	9th	10th	11th	c	6	2026-04-02 07:43:41.607412+00
38	4	Fundamental Rights are guaranteed under which Part?	Part II	Part III	Part IV	Part V	b	7	2026-04-02 07:43:45.366263+00
39	4	Zero hour in Indian Parliament begins at?	9:00 AM	11:00 AM	12 Noon	2:00 PM	c	8	2026-04-02 07:43:49.137711+00
40	4	Which article empowers Parliament to form new states?	Article 3	Article 5	Article 1	Article 370	a	9	2026-04-02 07:43:52.930336+00
41	5	What is the capital of India?	Mumbai	Kolkata	New Delhi	Chennai	c	0	2026-04-02 07:43:56.606807+00
42	5	Which vitamin is produced when skin is exposed to sunlight?	Vitamin A	Vitamin B	Vitamin C	Vitamin D	d	1	2026-04-02 07:44:00.323172+00
43	5	The Bharat Ratna was first awarded in which year?	1950	1952	1954	1966	c	2	2026-04-02 07:44:04.245313+00
44	5	Which is the longest river in India?	Yamuna	Brahmaputra	Ganga	Godavari	c	3	2026-04-02 07:44:08.025168+00
45	5	India's first supercomputer was named?	PARAM	ARYABHATTA	SHAKTI	AGNI	a	4	2026-04-02 07:44:11.791659+00
46	5	The Indian Constitution was adopted on?	15 Aug 1947	26 Jan 1950	26 Nov 1949	30 Jan 1948	c	5	2026-04-02 07:44:15.577819+00
47	5	Panchayati Raj was first introduced in which state?	UP	Rajasthan	Gujarat	Maharashtra	b	6	2026-04-02 07:44:19.396364+00
48	5	Which gas is most abundant in Earth's atmosphere?	Oxygen	CO2	Argon	Nitrogen	d	7	2026-04-02 07:44:23.152469+00
49	5	Who is known as Iron Man of India?	Mahatma Gandhi	Sardar Vallabhbhai Patel	Subhas Chandra Bose	Lal Bahadur Shastri	b	8	2026-04-02 07:44:26.799564+00
50	5	The treaty of Versailles was signed in which year?	1916	1918	1919	1920	c	9	2026-04-02 07:44:30.573801+00
51	6	Reserve Bank of India was established in?	1935	1947	1949	1955	a	0	2026-04-02 07:44:34.351145+00
52	6	What does NEFT stand for?	National Electronic Fund Transfer	National Emergency Fund Transfer	Net Electronic Fund Transfer	National Equity Fund Transfer	a	1	2026-04-02 07:44:38.084+00
53	6	SBI headquarters is located in?	New Delhi	Kolkata	Mumbai	Bengaluru	c	2	2026-04-02 07:44:41.833352+00
54	6	PMJDY was launched in which year?	2012	2013	2014	2015	c	3	2026-04-02 07:44:45.61754+00
55	6	Which is the apex bank of India?	SBI	NABARD	RBI	SIDBI	c	4	2026-04-02 07:44:49.449736+00
56	6	KYC stands for?	Keep Your Cash	Know Your Customer	Key Your Credit	Know Your Currency	b	5	2026-04-02 07:44:53.241425+00
57	6	Who regulates Mutual Funds in India?	RBI	SEBI	IRDAI	PFRDA	b	6	2026-04-02 07:44:57.140318+00
58	6	CRR stands for?	Credit Reserve Ratio	Cash Reserve Ratio	Capital Reserve Ratio	Current Reserve Ratio	b	7	2026-04-02 07:45:00.865001+00
11	2	Directive Principles of State Policy are borrowed from which constitution?	USA	UK	Ireland	Canada	C	0	2026-04-02 07:42:02.142658+00
59	6	The full form of ATM is?	Any Time Money	Automated Teller Machine	Automated Transaction Machine	Automatic Teller Machine	b	8	2026-04-02 07:45:04.526361+00
60	6	World Bank headquarters is located in?	New York	Geneva	Washington DC	London	c	9	2026-04-02 07:45:08.247101+00
61	7	Indian Railways was nationalized in which year?	1947	1950	1951	1952	d	0	2026-04-02 07:45:12.06304+00
62	7	Which is the longest railway platform in India?	Gorakhpur	Kharagpur	Kollam	Secunderabad	a	1	2026-04-02 07:45:15.855994+00
63	7	The first railway in India ran between?	Mumbai-Pune	Delhi-Agra	Mumbai-Thane	Kolkata-Asansol	c	2	2026-04-02 07:45:19.577584+00
64	7	Rajdhani Express connects various cities to?	Mumbai	Kolkata	New Delhi	Chennai	c	3	2026-04-02 07:45:23.315187+00
65	7	Vande Bharat Express is a?	Semi-high speed train	High-speed train	Bullet train	Monorail	a	4	2026-04-02 07:45:27.215034+00
66	7	The first Metro rail in India was started in which city?	Delhi	Mumbai	Kolkata	Chennai	c	5	2026-04-02 07:45:31.147655+00
67	7	IRCTC stands for?	Indian Railway Catering Transport Corp	Indian Railway Catering and Tourism Corp	Indian Rail Commerce Corp	Indian Railway Commerce Corp	b	6	2026-04-02 07:45:34.869011+00
68	7	RRB stands for?	Rail Recruitment Bureau	Railway Recruitment Board	Railway Resource Board	Rail Resource Bureau	b	7	2026-04-02 07:45:38.606418+00
69	7	Colour of first class coach in Indian Railways?	Blue	Red	Green	Yellow	b	8	2026-04-02 07:45:42.355173+00
70	7	Which zone has headquarters in Mumbai?	Western Railway only	Central Railway only	Both Western and Central	Southern Railway	c	9	2026-04-02 07:45:46.126364+00
71	8	Directive Principles of State Policy are borrowed from which constitution?	USA	UK	Ireland	Canada	c	0	2026-04-02 07:45:49.853827+00
72	8	Which article of Indian Constitution abolishes untouchability?	Article 14	Article 15	Article 17	Article 19	c	1	2026-04-02 07:45:53.696825+00
73	8	Planning Commission was replaced by NITI Aayog in?	2013	2014	2015	2016	c	2	2026-04-02 07:45:57.392828+00
74	8	The Constituent Assembly was formed based on which plan?	Mountbatten Plan	Wavell Plan	Cabinet Mission Plan	Cripps Mission	c	3	2026-04-02 07:46:01.259651+00
75	8	Who was the first Chairman of Planning Commission?	Dr. Ambedkar	Jawaharlal Nehru	Sardar Patel	Rajendra Prasad	b	4	2026-04-02 07:46:05.210821+00
76	8	The term secular was added to Preamble by which amendment?	42nd	44th	52nd	73rd	a	5	2026-04-02 07:46:08.915452+00
77	8	Which schedule contains the anti-defection law?	8th	9th	10th	11th	c	6	2026-04-02 07:46:12.681423+00
78	8	Fundamental Rights are guaranteed under which Part?	Part II	Part III	Part IV	Part V	b	7	2026-04-02 07:46:16.440576+00
79	8	Zero hour in Indian Parliament begins at?	9:00 AM	11:00 AM	12 Noon	2:00 PM	c	8	2026-04-02 07:46:20.227448+00
80	8	Which article empowers Parliament to form new states?	Article 3	Article 5	Article 1	Article 370	a	9	2026-04-02 07:46:24.24989+00
81	9	What is the capital of India?	Mumbai	Kolkata	New Delhi	Chennai	c	0	2026-04-02 07:46:27.988268+00
82	9	Which vitamin is produced when skin is exposed to sunlight?	Vitamin A	Vitamin B	Vitamin C	Vitamin D	d	1	2026-04-02 07:46:31.806659+00
83	9	The Bharat Ratna was first awarded in which year?	1950	1952	1954	1966	c	2	2026-04-02 07:46:35.684559+00
84	9	Which is the longest river in India?	Yamuna	Brahmaputra	Ganga	Godavari	c	3	2026-04-02 07:46:39.493145+00
85	9	India's first supercomputer was named?	PARAM	ARYABHATTA	SHAKTI	AGNI	a	4	2026-04-02 07:46:43.308114+00
86	9	The Indian Constitution was adopted on?	15 Aug 1947	26 Jan 1950	26 Nov 1949	30 Jan 1948	c	5	2026-04-02 07:46:47.036945+00
87	9	Panchayati Raj was first introduced in which state?	UP	Rajasthan	Gujarat	Maharashtra	b	6	2026-04-02 07:46:50.752296+00
88	9	Which gas is most abundant in Earth's atmosphere?	Oxygen	CO2	Argon	Nitrogen	d	7	2026-04-02 07:46:54.507948+00
89	9	Who is known as Iron Man of India?	Mahatma Gandhi	Sardar Vallabhbhai Patel	Subhas Chandra Bose	Lal Bahadur Shastri	b	8	2026-04-02 07:46:58.403061+00
90	9	The treaty of Versailles was signed in which year?	1916	1918	1919	1920	c	9	2026-04-02 07:47:02.248107+00
91	10	Reserve Bank of India was established in?	1935	1947	1949	1955	a	0	2026-04-02 07:47:06.059808+00
92	10	What does NEFT stand for?	National Electronic Fund Transfer	National Emergency Fund Transfer	Net Electronic Fund Transfer	National Equity Fund Transfer	a	1	2026-04-02 07:47:09.806474+00
93	10	SBI headquarters is located in?	New Delhi	Kolkata	Mumbai	Bengaluru	c	2	2026-04-02 07:47:13.438987+00
94	10	PMJDY was launched in which year?	2012	2013	2014	2015	c	3	2026-04-02 07:47:17.32967+00
95	10	Which is the apex bank of India?	SBI	NABARD	RBI	SIDBI	c	4	2026-04-02 07:47:21.143121+00
96	10	KYC stands for?	Keep Your Cash	Know Your Customer	Key Your Credit	Know Your Currency	b	5	2026-04-02 07:47:24.930774+00
97	10	Who regulates Mutual Funds in India?	RBI	SEBI	IRDAI	PFRDA	b	6	2026-04-02 07:47:28.757011+00
98	10	CRR stands for?	Credit Reserve Ratio	Cash Reserve Ratio	Capital Reserve Ratio	Current Reserve Ratio	b	7	2026-04-02 07:47:32.45602+00
99	10	The full form of ATM is?	Any Time Money	Automated Teller Machine	Automated Transaction Machine	Automatic Teller Machine	b	8	2026-04-02 07:47:36.179413+00
100	10	World Bank headquarters is located in?	New York	Geneva	Washington DC	London	c	9	2026-04-02 07:47:39.972865+00
101	11	National Defence Academy (NDA) is located in?	Dehradun	Pune	Khadakwasla	Mussourie	c	0	2026-04-02 07:47:43.782911+00
102	11	NDA exam is conducted by?	Army HQ	UPSC	SSB	Ministry of Defence	b	1	2026-04-02 07:47:47.546437+00
103	11	First Chief of Defence Staff of India was?	Bipin Rawat	V.K. Singh	Dalbir Singh Suhag	Anil Chauhan	a	2	2026-04-02 07:47:51.338924+00
104	11	Operation Vijay was related to which conflict?	Kargil War	1971 War	1965 War	Siachen	a	3	2026-04-02 07:47:55.08995+00
105	11	INS Vikrant is India's?	Nuclear submarine	Indigenously built aircraft carrier	Destroyer	Frigate	b	4	2026-04-02 07:47:58.79958+00
106	11	Param Vir Chakra is India's highest?	Civilian honour	Military honour in peacetime	Military honour in wartime	Sports honour	c	5	2026-04-02 07:48:02.505935+00
107	11	Indian Coast Guard was established in?	1977	1978	1980	1982	b	6	2026-04-02 07:48:06.222965+00
108	11	Arjun is India's main battle tank. It belongs to which generation?	2nd	3rd	3.5th	4th	c	7	2026-04-02 07:48:09.878494+00
109	11	The highest civilian award in India is?	Padma Shri	Bharat Ratna	Padma Bhushan	Padma Vibhushan	b	8	2026-04-02 07:48:13.602336+00
110	11	Which is the oldest regiment of the Indian Army?	Rajput Regiment	Punjab Regiment	Madras Regiment	Bihar Regiment	c	9	2026-04-02 07:48:17.456243+00
111	12	National Defence Academy (NDA) is located in?	Dehradun	Pune	Khadakwasla	Mussourie	c	0	2026-04-02 07:48:21.168418+00
112	12	NDA exam is conducted by?	Army HQ	UPSC	SSB	Ministry of Defence	b	1	2026-04-02 07:48:24.948677+00
113	12	First Chief of Defence Staff of India was?	Bipin Rawat	V.K. Singh	Dalbir Singh Suhag	Anil Chauhan	a	2	2026-04-02 07:48:28.680433+00
114	12	Operation Vijay was related to which conflict?	Kargil War	1971 War	1965 War	Siachen	a	3	2026-04-02 07:48:32.417944+00
115	12	INS Vikrant is India's?	Nuclear submarine	Indigenously built aircraft carrier	Destroyer	Frigate	b	4	2026-04-02 07:48:36.176687+00
116	12	Param Vir Chakra is India's highest?	Civilian honour	Military honour in peacetime	Military honour in wartime	Sports honour	c	5	2026-04-02 07:48:39.959669+00
117	12	Indian Coast Guard was established in?	1977	1978	1980	1982	b	6	2026-04-02 07:48:44.101688+00
118	12	Arjun is India's main battle tank. It belongs to which generation?	2nd	3rd	3.5th	4th	c	7	2026-04-02 07:48:47.960664+00
119	12	The highest civilian award in India is?	Padma Shri	Bharat Ratna	Padma Bhushan	Padma Vibhushan	b	8	2026-04-02 07:48:51.666993+00
120	12	Which is the oldest regiment of the Indian Army?	Rajput Regiment	Punjab Regiment	Madras Regiment	Bihar Regiment	c	9	2026-04-02 07:48:55.398424+00
121	4	What is the capital of India?	Mumbai	New Delhi	Kolkata	Chennai	B	11	2026-04-02 08:36:31.711351+00
122	4	Who wrote the Indian National Anthem?	Rabindranath Tagore	Bankim Chandra	Mahatma Gandhi	Jawaharlal Nehru	A	12	2026-04-02 08:39:55.337081+00
31	4	Directive Principles of State Policy are borrowed from which constitution? (edited)	USA	UK	Ireland	Canada	C	0	2026-04-02 07:43:18.735644+00
\.


--
-- Data for Name: registrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.registrations (id, user_id, exam_id, amount_paid, registered_at) FROM stdin;
1	3	3	5.00	2026-04-02 10:43:34.78389+00
2	1	3	5.00	2026-04-02 11:31:43.235101+00
3	9	2	5.00	2026-04-02 11:44:13.155906+00
4	9	8	5.00	2026-04-02 12:01:04.380035+00
5	8	2	5.00	2026-04-02 12:43:07.385156+00
6	9	4	5.00	2026-04-02 13:28:00.500975+00
\.


--
-- Data for Name: submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.submissions (id, user_id, exam_id, score, total_questions, correct_answers, time_taken_seconds, rank, submitted_at) FROM stdin;
1	9	8	0	10	0	49	1	2026-04-02 12:45:13.325864+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password_hash, wallet_balance, avatar_url, is_admin, is_blocked, created_at, updated_at, phone, govt_id, pan_card_url, verification_status) FROM stdin;
8	kundan kumar	kundansinghofficial@gmail.com	$2b$10$yWGZwXWK4ZdVbuYpNHETVugaZV8P5O8AJr6HJoAHyRDJKExe1Vhmq	49995.00	\N	f	f	2026-04-02 07:34:58.467245+00	2026-04-02 15:55:22.386+00	7782829415	77828288288	data:image/png;base64,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	verified
2	Arjun Sharma	test@rankyatra.com	$2b$10$3UupFZN51Xkaa8PyOktptuf13AgoeWkbeYD5BToSY4vnUYVlaGxDe	500.00	\N	f	f	2026-04-02 07:12:08.873354+00	2026-04-02 07:12:08.873354+00	\N	\N	\N	not_submitted
4	Rohit Verma	rohit@rankyatra.com	$2b$10$YR7dGJ9ZIYINB2pPSnXRLOv78jwCBI25Egj/wR7rkZRWQbTsRzJQS	0.00	\N	f	f	2026-04-02 07:29:06.787039+00	2026-04-02 07:29:06.787039+00	\N	\N	\N	not_submitted
5	Anjali Singh	anjali@rankyatra.com	$2b$10$WMQXhs2HzaOw/qXgcw3bnOOnqKuhj57o.VvTMMBMQ3VO7RIfAXLP2	0.00	\N	f	f	2026-04-02 07:29:07.027202+00	2026-04-02 07:29:07.027202+00	\N	\N	\N	not_submitted
6	Vikram Patel	vikram@rankyatra.com	$2b$10$tPHuBbYdje2Qeud4mV1areVOJ0FITFsZbNso6TabQ9YqvY4S0u/pm	0.00	\N	f	f	2026-04-02 07:29:07.268079+00	2026-04-02 07:29:07.268079+00	\N	\N	\N	not_submitted
7	Sneha Rao	sneha@rankyatra.com	$2b$10$qmraVv2bwgX.GL.xxkQTJOhVq0RqkPaE.PFMVsRyoIGPZp/jutntm	400.00	\N	f	f	2026-04-02 07:29:07.515659+00	2026-04-02 10:41:14.665+00	\N	\N	\N	not_submitted
1	Admin User	admin@rankyatra.com	$2b$10$KWrXRNcB7beBOg0Vvj7ARe2kgzkbLr6NN7YXnewqIif5hRaslTYH6	9995.00	\N	t	f	2026-04-02 07:11:53.369529+00	2026-04-02 11:31:43.201+00	\N	\N	\N	not_submitted
3	Priya Sharma Test	priya@rankyatra.com	$2b$10$X8Xxw6smY8nF2XF/lD3RYO3cf2ssaOTEBzBdtNHnuoBc0f0h.7ZNK	495.00	\N	f	f	2026-04-02 07:29:06.37601+00	2026-04-02 14:16:58.682+00	\N	\N	\N	not_submitted
9	Nisha Verma	nishaverma75756@gmail.com	$2b$10$4pb0QRJm36LbiuW.3IzzsudeDBUaqSfFRh4e7nn72A/FP6vsfE63C	335.00	/api/storage/avatars/5fcd61f9-9459-49a5-b648-120733535216.png	f	f	2026-04-02 11:16:19.027212+00	2026-04-02 14:52:14.587+00	\N	\N	\N	not_submitted
\.


--
-- Data for Name: verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verifications (id, user_id, govt_id, pan_card_url, status, admin_note, created_at, updated_at) FROM stdin;
1	8	59865556566	data:image/png;base64,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	rejected	pan card not valid	2026-04-02 15:45:14.489872+00	2026-04-02 15:46:22.388+00
2	8	77828288288	data:image/png;base64,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	approved		2026-04-02 15:47:38.224364+00	2026-04-02 15:47:45.967+00
\.


--
-- Data for Name: wallet_deposits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_deposits (id, user_id, amount, utr_number, status, admin_note, created_at, updated_at) FROM stdin;
1	3	500.00	UTR123456789012	success	Payment verified	2026-04-02 13:52:01.516173	2026-04-02 13:52:14.202
2	9	100.00	456777788899	success	\N	2026-04-02 13:55:51.475388	2026-04-02 13:56:37.151
3	9	100.00	575758484	rejected	not paid	2026-04-02 14:14:54.439009	2026-04-02 14:15:20.045
\.


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_transactions (id, user_id, amount, type, description, balance_after, created_at) FROM stdin;
1	2	500.00	credit	Welcome bonus	500.00	2026-04-02 07:12:31.477062+00
2	3	100.00	credit	Test bonus	100.00	2026-04-02 08:35:57.282736+00
3	8	50000.00	credit	Admin adjustment	50000.00	2026-04-02 10:41:07.888193+00
4	7	400.00	credit	Admin adjustment	400.00	2026-04-02 10:41:14.66882+00
5	3	5.00	debit	Exam registration: Banking Awareness Test	95.00	2026-04-02 10:43:34.779957+00
6	9	500.00	credit	cashback	500.00	2026-04-02 11:17:37.093155+00
7	1	5.00	debit	Exam registration: Banking Awareness Test	9995.00	2026-04-02 11:31:43.231443+00
8	9	5.00	debit	Exam registration: UPSC Prelims Mock	495.00	2026-04-02 11:44:13.152006+00
9	9	5.00	debit	Exam registration: UPSC CSAT Paper II Practice	490.00	2026-04-02 12:01:04.376494+00
10	8	5.00	debit	Exam registration: UPSC Prelims Mock	49995.00	2026-04-02 12:43:07.382522+00
11	9	5.00	debit	Exam registration: UPSC Civil Services Prelims 2026	485.00	2026-04-02 13:28:00.497101+00
12	3	500.00	credit	Wallet top-up via UPI (UTR: UTR123456789012)	595.00	2026-04-02 13:52:14.209359+00
13	9	100.00	credit	Wallet top-up via UPI (UTR: 456777788899)	585.00	2026-04-02 13:56:37.159179+00
14	3	100.00	debit	Withdrawal request via UPI (ID: #1)	495.00	2026-04-02 14:16:46.13333+00
15	3	50.00	debit	Withdrawal request via Bank Transfer (ID: #2)	445.00	2026-04-02 14:16:58.588324+00
16	3	50.00	credit	Withdrawal #2 rejected — amount refunded	495.00	2026-04-02 14:16:58.68527+00
17	9	50.00	debit	Withdrawal request via UPI (ID: #3)	535.00	2026-04-02 14:21:23.008066+00
18	9	100.00	debit	Withdrawal request via UPI (ID: #4)	435.00	2026-04-02 14:24:54.317269+00
19	9	200.00	debit	Withdrawal request via UPI (ID: #5)	235.00	2026-04-02 14:43:31.912019+00
20	9	100.00	debit	Withdrawal request via Bank Transfer (ID: #6)	135.00	2026-04-02 14:45:44.712005+00
21	9	200.00	credit	Withdrawal #5 rejected — amount refunded	335.00	2026-04-02 14:46:12.362249+00
\.


--
-- Data for Name: wallet_withdrawals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_withdrawals (id, user_id, amount, payment_method, payment_details, status, admin_utr_number, admin_note, created_at, updated_at) FROM stdin;
1	3	100.00	upi	priya@gpay	approved	UTR9988776655	Paid via GPay	2026-04-02 14:16:46.126551	2026-04-02 14:16:46.474
2	3	50.00	bank	Account: 1234567890\nIFSC: SBIN0001234\nName: Priya	rejected	\N	Invalid account details	2026-04-02 14:16:58.584216	2026-04-02 14:16:58.678
3	9	50.00	upi	9621819282@ybl	approved	568942658	payment successfull	2026-04-02 14:21:23.004268	2026-04-02 14:22:03.277
4	9	100.00	upi	9621819282@ybl	approved	55475278587	\N	2026-04-02 14:24:54.312892	2026-04-02 14:26:08.394
6	9	100.00	bank	Account Number: 11808527904\nIFSC Code: SBIN0006011\nAccount Holder Name: Nisha Verma\nBank Name: State Bank of India (SBI)	approved	55468464	\N	2026-04-02 14:45:44.708129	2026-04-02 14:46:08.767
5	9	200.00	upi	9621819282@ybl	rejected	\N	\N	2026-04-02 14:43:31.908569	2026-04-02 14:46:12.355
\.


--
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.exams_id_seq', 12, true);


--
-- Name: payment_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_settings_id_seq', 1, true);


--
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.questions_id_seq', 122, true);


--
-- Name: registrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.registrations_id_seq', 6, true);


--
-- Name: submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.submissions_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- Name: verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.verifications_id_seq', 2, true);


--
-- Name: wallet_deposits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallet_deposits_id_seq', 3, true);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallet_transactions_id_seq', 21, true);


--
-- Name: wallet_withdrawals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallet_withdrawals_id_seq', 6, true);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: payment_settings payment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settings
    ADD CONSTRAINT payment_settings_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: registrations unique_user_exam; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT unique_user_exam UNIQUE (user_id, exam_id);


--
-- Name: submissions unique_user_exam_submission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT unique_user_exam_submission UNIQUE (user_id, exam_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: wallet_deposits wallet_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_deposits
    ADD CONSTRAINT wallet_deposits_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallet_withdrawals wallet_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_withdrawals
    ADD CONSTRAINT wallet_withdrawals_pkey PRIMARY KEY (id);


--
-- Name: questions questions_exam_id_exams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_exam_id_exams_id_fk FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: registrations registrations_exam_id_exams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_exam_id_exams_id_fk FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: registrations registrations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_exam_id_exams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_exam_id_exams_id_fk FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verifications verifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet_deposits wallet_deposits_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_deposits
    ADD CONSTRAINT wallet_deposits_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet_transactions wallet_transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallet_withdrawals wallet_withdrawals_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_withdrawals
    ADD CONSTRAINT wallet_withdrawals_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 3IPuftKgcDga6J7JnGxcgmD32jpPhJsw8FJbKM4jF3oIekaoYt7XGJGqrQbJxOV

