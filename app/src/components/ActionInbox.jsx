"use client";
import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CheckSquare, Briefcase, Calendar, Clock, AlertCircle, 
  ChevronRight, MoreHorizontal, Trash2, Check, ExternalLink,
  MessageSquare, User, TrendingUp, Filter, Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

/**
 * Action Inbox: Centralized management for AI-extracted Opportunities and Tasks.
 */
export default function ActionInbox() {
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    // Listen for all opportunities
    const oppsQuery = query(collection(db, "opportunities"), orderBy("createdAt", "desc"));
    const unsubOpps = onSnapshot(oppsQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOpportunities(data);
      if (loading) setLoading(false);
    });

    // Listen for all tasks
    const tasksQuery = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const unsubTasks = onSnapshot(tasksQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(data);
    });

    return () => {
      unsubOpps();
      unsubTasks();
    };
  }, []);

  const handleUpdateOpp = async (id, stage) => {
    try {
      await updateDoc(doc(db, "opportunities", id), { stage, updatedAt: new Date() });
    } catch (e) { console.error(e); }
  };

  const handleUpdateTask = async (id, status) => {
    try {
      await updateDoc(doc(db, "tasks", id), { status, updatedAt: new Date() });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (collectionName, id) => {
    if (confirm("Deseja realmente remover este registro?")) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (e) { console.error(e); }
    }
  };

  const filteredItems = (activeTab === "opportunities" || activeTab === "all" ? opportunities : [])
    .concat(activeTab === "tasks" || activeTab === "all" ? tasks : [])
    .filter(item => {
      const text = (item.title || item.description || "").toLowerCase();
      return text.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  return (
    <div className="flex flex-col h-full bg-[#0e0e0e]">
      {/* Header */}
      <div className="p-8 bg-[#131313] border-b border-white/5 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-1.5 h-12 bg-[#97a5ff]" />
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-normal uppercase tracking-tighter text-foreground leading-none font-display">
                ACTION_INBOX.LOG
              </h2>
              <p className="text-[11px] font-mono font-black uppercase tracking-[0.25em] text-muted-foreground/40">
                SISTEMA_DE_CAPTAÇÃO_E_RESOLUÇÃO_DE_DEMANDAS
              </p>
            </div>
          </div>
          <Badge className="bg-[#1f2020] text-primary border-none text-[11px] font-black uppercase px-3 py-1 rounded-none tracking-widest font-mono">
            {filteredItems.length} ACTIVE_RECORDS
          </Badge>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
            <Input 
              placeholder="PESQUISAR_NO_INBOX..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-[#1a1b1c] border-white/5 rounded-none text-[11px] uppercase font-mono tracking-widest focus-visible:ring-primary/20"
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-[#1a1b1c] p-1 border border-white/5">
            <TabsList className="bg-transparent h-9 gap-1">
              <TabsTrigger value="all" className="data-[state=active]:bg-[#0e0e0e] data-[state=active]:text-primary text-[11px] font-normal uppercase tracking-widest h-7 px-4 rounded-none transition-none font-display">TUDO</TabsTrigger>
              <TabsTrigger value="opportunities" className="data-[state=active]:bg-[#0e0e0e] data-[state=active]:text-primary text-[11px] font-normal uppercase tracking-widest h-7 px-4 rounded-none transition-none font-display">OPORTUNIDADES</TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:bg-[#0e0e0e] data-[state=active]:text-primary text-[11px] font-normal uppercase tracking-widest h-7 px-4 rounded-none transition-none font-display">TAREFAS</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="grid grid-cols-1 gap-2">
          {filteredItems.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center gap-4 opacity-20">
              <Clock size={48} strokeWidth={1} />
              <span className="text-[11px] font-mono font-black uppercase tracking-[0.5em]">BUFFER_EMPTY</span>
            </div>
          ) : (
            filteredItems.map((item) => (
              <ActionItem 
                key={item.id} 
                item={item} 
                onUpdateOpp={handleUpdateOpp}
                onUpdateTask={handleUpdateTask}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActionItem({ item, onUpdateOpp, onUpdateTask, onDelete }) {
  const isOpp = !!item.title;
  const CollectionIcon = isOpp ? Briefcase : CheckSquare;
  const statusColor = isOpp ? "text-primary" : "text-amber-500";
  const borderColor = isOpp ? "border-primary/5" : "border-amber-500/5";
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-[#111111] border ${borderColor} p-5 flex flex-col md:flex-row items-start md:items-center gap-6 hover:bg-[#151515] hover:border-white/10 transition-all relative overflow-hidden`}
    >
      {/* Type indicator pillar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isOpp ? 'bg-primary/40' : 'bg-amber-500/40'} opacity-30 group-hover:opacity-100 transition-opacity`} />
      
      {/* Icon & ID */}
      <div className="flex items-center gap-4 shrink-0">
        <div className={`w-10 h-10 flex items-center justify-center bg-white/5 border border-white/5 ${statusColor}`}>
          <CollectionIcon size={20} />
        </div>
        <div className="flex flex-col">
          <span className={`text-[10px] font-mono font-black uppercase tracking-widest ${statusColor} opacity-60`}>
            {isOpp ? 'OPPORTUNITY' : 'TASK_ACTION'}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/30">{item.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-normal uppercase tracking-tight text-white mb-1 truncate font-display">
          {isOpp ? item.title : item.description}
        </h3>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground/60 uppercase">
          <span className="flex items-center gap-1.5">
            <MessageSquare size={10} /> {item.remoteJid?.split('@')[0] || 'SYSTEM'}
          </span>
          <span className="text-white/10">•</span>
          <span className="flex items-center gap-1.5">
            <Calendar size={10} /> {item.createdAt?.toDate()?.toLocaleDateString("pt-BR")}
          </span>
          {item.estimatedValue && (
             <>
               <span className="text-white/10">•</span>
               <span className="text-primary font-black">VAL_EST: R$ {item.estimatedValue}</span>
             </>
          )}
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-6 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-none border-white/5">
        <div className="flex flex-col gap-1 items-end shrink-0 hidden sm:flex">
          <span className="text-[10px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">CURRENT_STATUS</span>
          <Badge className={`bg-transparent border-white/10 ${statusColor} rounded-none text-[11px] font-black uppercase tracking-tighter`}>
            {isOpp ? (item.stage || 'NEW') : (item.status || 'PENDING')}
          </Badge>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isOpp ? (
             <Button 
               variant="outline" size="sm" 
               className="h-9 px-4 border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-black font-black text-[9px] tracking-widest uppercase transition-none rounded-none"
               onClick={() => onUpdateOpp(item.id, 'closed_won')}
             >
               CONCLUIR
             </Button>
          ) : (
            <Button 
              variant="outline" size="sm" 
              className="h-9 px-4 border-amber-500/10 bg-amber-500/5 text-amber-500 hover:bg-amber-500 hover:text-black font-black text-[9px] tracking-widest uppercase transition-none rounded-none"
              onClick={() => onUpdateTask(item.id, 'completed')}
            >
              RESOLVER
            </Button>
          )}
          
          <Separator orientation="vertical" className="h-4 bg-white/5 mx-1" />
          
          <Button 
            variant="ghost" size="icon" 
            className="h-9 w-9 text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 transition-none rounded-none"
            onClick={() => onDelete(isOpp ? 'opportunities' : 'tasks', item.id)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
