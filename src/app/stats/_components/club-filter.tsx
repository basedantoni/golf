'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Filter } from 'lucide-react';

interface Club {
  id: string;
  name: string;
}

interface ClubFilterProps {
  clubs: Club[];
  excludedIds: string[];
  onChange: (excludedIds: string[]) => void;
}

export function ClubFilter({ clubs, excludedIds, onChange }: ClubFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleClub = (clubId: string) => {
    if (excludedIds.includes(clubId)) {
      onChange(excludedIds.filter((id) => id !== clubId));
    } else {
      onChange([...excludedIds, clubId]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" />
            Filter Clubs
            {excludedIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {excludedIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Exclude Clubs</span>
              {excludedIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-auto p-1 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="p-2 space-y-1">
              {clubs.map((club) => (
                <label
                  key={club.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={excludedIds.includes(club.id)}
                    onCheckedChange={() => toggleClub(club.id)}
                  />
                  <span className="text-sm">{club.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Show excluded clubs as badges */}
      <div className="flex flex-wrap gap-1">
        {excludedIds.slice(0, 3).map((id) => {
          const club = clubs.find((c) => c.id === id);
          return club ? (
            <Badge key={id} variant="secondary" className="text-xs">
              {club.name}
              <button
                onClick={() => toggleClub(id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ) : null;
        })}
        {excludedIds.length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{excludedIds.length - 3} more
          </Badge>
        )}
      </div>
    </div>
  );
}
